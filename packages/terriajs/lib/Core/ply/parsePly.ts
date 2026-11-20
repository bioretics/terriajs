export type PlyFormat = "ascii" | "binary_little_endian" | "binary_big_endian";

export type PlyScalarType =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "float32"
  | "float64";

export interface PlyProperty {
  name: string;
  type: PlyScalarType;
  countType?: PlyScalarType;
}

export interface PlyElement {
  name: string;
  count: number;
  properties: PlyProperty[];
}

export interface PlyHeader {
  format: PlyFormat;
  elements: PlyElement[];
  headerLength: number;
}

export interface PlyData {
  positions: Float64Array;
  colors?: Uint8Array;
  hasAlpha: boolean;
  normals?: Float32Array;
  indices?: Uint32Array;
  sourceVertexCount: number;
}

export type PlyErrorCode =
  | "invalidHeader"
  | "truncated"
  | "invalidData"
  | "noVertices";

export class PlyError extends Error {
  constructor(
    readonly code: PlyErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlyError";
  }
}

const MAX_HEADER_BYTES = 1024 * 1024;

const TYPE_ALIASES: Record<string, PlyScalarType | undefined> = {
  char: "int8",
  int8: "int8",
  uchar: "uint8",
  uint8: "uint8",
  short: "int16",
  int16: "int16",
  ushort: "uint16",
  uint16: "uint16",
  int: "int32",
  int32: "int32",
  uint: "uint32",
  uint32: "uint32",
  float: "float32",
  float32: "float32",
  double: "float64",
  float64: "float64"
};

function toScalarType(name: string | undefined): PlyScalarType {
  const type = name === undefined ? undefined : TYPE_ALIASES[name];
  if (type === undefined) {
    throw new PlyError("invalidHeader", `Unknown property type "${name}"`);
  }
  return type;
}

export function parsePlyHeader(buffer: ArrayBuffer): PlyHeader {
  const text = new TextDecoder("latin1").decode(
    new Uint8Array(buffer, 0, Math.min(buffer.byteLength, MAX_HEADER_BYTES))
  );
  const end = /(^|\n)end_header[ \t]*\r?\n/.exec(text);
  if (!/^ply[ \t]*\r?\n/.test(text) || end === null) {
    throw new PlyError("invalidHeader", "Missing `ply` or `end_header`");
  }

  let format: PlyFormat | undefined;
  const elements: PlyElement[] = [];
  for (const line of text.slice(0, end.index).split(/\r?\n/).slice(1)) {
    const tokens = line.trim().split(/\s+/);
    switch (tokens[0]) {
      case "format":
        if (
          tokens[1] !== "ascii" &&
          tokens[1] !== "binary_little_endian" &&
          tokens[1] !== "binary_big_endian"
        ) {
          throw new PlyError("invalidHeader", `Unknown format "${tokens[1]}"`);
        }
        format = tokens[1];
        break;
      case "element": {
        const count = Number(tokens[2]);
        if (tokens[1] === undefined || !Number.isInteger(count) || count < 0) {
          throw new PlyError("invalidHeader", `Invalid element "${line}"`);
        }
        elements.push({ name: tokens[1], count, properties: [] });
        break;
      }
      case "property": {
        const element = elements[elements.length - 1];
        if (element === undefined) {
          throw new PlyError("invalidHeader", "Property before any element");
        }
        const property: PlyProperty =
          tokens[1] === "list"
            ? {
                countType: toScalarType(tokens[2]),
                type: toScalarType(tokens[3]),
                name: tokens[4] ?? ""
              }
            : { type: toScalarType(tokens[1]), name: tokens[2] ?? "" };
        element.properties.push(property);
        break;
      }
    }
  }

  if (format === undefined) {
    throw new PlyError("invalidHeader", "Missing `format`");
  }

  return { format, elements, headerLength: end.index + end[0].length };
}

interface ValueReader {
  read(type: PlyScalarType): number;
}

class BinaryValueReader implements ValueReader {
  constructor(
    private readonly view: DataView,
    private offset: number,
    private readonly littleEndian: boolean
  ) {}

  read(type: PlyScalarType): number {
    const view = this.view;
    const o = this.offset;
    switch (type) {
      case "int8":
        this.offset = o + 1;
        return view.getInt8(o);
      case "uint8":
        this.offset = o + 1;
        return view.getUint8(o);
      case "int16":
        this.offset = o + 2;
        return view.getInt16(o, this.littleEndian);
      case "uint16":
        this.offset = o + 2;
        return view.getUint16(o, this.littleEndian);
      case "int32":
        this.offset = o + 4;
        return view.getInt32(o, this.littleEndian);
      case "uint32":
        this.offset = o + 4;
        return view.getUint32(o, this.littleEndian);
      case "float32":
        this.offset = o + 4;
        return view.getFloat32(o, this.littleEndian);
      case "float64":
        this.offset = o + 8;
        return view.getFloat64(o, this.littleEndian);
    }
  }
}

class AsciiValueReader implements ValueReader {
  private pos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  read(): number {
    const bytes = this.bytes;
    const length = bytes.length;
    let pos = this.pos;
    while (pos < length && bytes[pos] <= 32) pos++;
    if (pos >= length) {
      throw new PlyError("truncated", "Unexpected end of file");
    }
    let token = "";
    while (pos < length && bytes[pos] > 32) {
      token += String.fromCharCode(bytes[pos++]);
    }
    this.pos = pos;
    const value = Number(token);
    if (Number.isNaN(value)) {
      throw new PlyError("invalidData", `Invalid number "${token}"`);
    }
    return value;
  }
}

function toColorByte(value: number, type: PlyScalarType): number {
  const scaled =
    type === "float32" || type === "float64"
      ? value * 255
      : type === "uint16"
        ? value / 257
        : value;
  return Math.min(255, Math.max(0, Math.round(scaled)));
}

function skipList(reader: ValueReader, property: PlyProperty) {
  const count = reader.read(property.countType!);
  for (let k = 0; k < count; k++) reader.read(property.type);
}

export interface ParsePlyOptions {
  maximumPoints?: number;
}

export function parsePly(
  buffer: ArrayBuffer,
  options: ParsePlyOptions = {}
): PlyData {
  const header = parsePlyHeader(buffer);

  const vertexElement = header.elements.find((e) => e.name === "vertex");
  const props = vertexElement?.properties ?? [];
  const find = (...names: string[]) =>
    props.findIndex((p) => p.countType === undefined && names.includes(p.name));
  const xyz = [find("x"), find("y"), find("z")];
  if (
    vertexElement === undefined ||
    vertexElement.count === 0 ||
    xyz.some((i) => i < 0)
  ) {
    throw new PlyError("noVertices", "No vertices with x, y, z found");
  }
  const rgb = [
    find("red", "diffuse_red"),
    find("green", "diffuse_green"),
    find("blue", "diffuse_blue")
  ];
  const alphaIndex = find("alpha", "diffuse_alpha");
  const hasColors = rgb.every((i) => i >= 0);
  const hasAlpha = hasColors && alphaIndex >= 0;
  const nxyz = [find("nx"), find("ny"), find("nz")];
  const hasNormals = nxyz.every((i) => i >= 0);

  const faceElement = header.elements.find(
    (e) => e.name === "face" && e.count > 0
  );
  const faceListIndex =
    faceElement?.properties.findIndex(
      (p) =>
        p.countType !== undefined &&
        (p.name === "vertex_indices" || p.name === "vertex_index")
    ) ?? -1;
  const isMesh = faceElement !== undefined && faceListIndex >= 0;

  const sourceCount = vertexElement.count;
  const maximumPoints = options.maximumPoints;
  const stride =
    isMesh || !maximumPoints || sourceCount <= maximumPoints
      ? 1
      : Math.ceil(sourceCount / maximumPoints);
  const count = Math.ceil(sourceCount / stride);

  const positions = new Float64Array(count * 3);
  const colors = hasColors ? new Uint8Array(count * 4) : undefined;
  const normals = hasNormals ? new Float32Array(count * 3) : undefined;
  let indices = new Uint32Array(isMesh ? faceElement.count * 3 : 0);
  let indexCount = 0;

  const reader: ValueReader =
    header.format === "ascii"
      ? new AsciiValueReader(new Uint8Array(buffer, header.headerLength))
      : new BinaryValueReader(
          new DataView(buffer),
          header.headerLength,
          header.format === "binary_little_endian"
        );

  const readVertices = () => {
    const row = new Float64Array(props.length);
    for (let i = 0; i < sourceCount; i++) {
      for (let p = 0; p < props.length; p++) {
        const property = props[p];
        if (property.countType !== undefined) skipList(reader, property);
        else row[p] = reader.read(property.type);
      }
      if (i % stride !== 0) continue;
      const j = i / stride;
      for (let c = 0; c < 3; c++) {
        positions[j * 3 + c] = row[xyz[c]];
        if (normals) normals[j * 3 + c] = row[nxyz[c]];
        if (colors)
          colors[j * 4 + c] = toColorByte(row[rgb[c]], props[rgb[c]].type);
      }
      if (colors) {
        colors[j * 4 + 3] = hasAlpha
          ? toColorByte(row[alphaIndex], props[alphaIndex].type)
          : 255;
      }
    }
  };

  const readFaces = (element: PlyElement) => {
    const polygon: number[] = [];
    for (let f = 0; f < element.count; f++) {
      for (let p = 0; p < element.properties.length; p++) {
        const property = element.properties[p];
        if (p !== faceListIndex) {
          if (property.countType !== undefined) skipList(reader, property);
          else reader.read(property.type);
          continue;
        }
        const n = reader.read(property.countType!);
        polygon.length = 0;
        for (let k = 0; k < n; k++) {
          const index = reader.read(property.type);
          if (!Number.isInteger(index) || index < 0 || index >= sourceCount) {
            throw new PlyError(
              "invalidData",
              `Face ${f} references missing vertex ${index}`
            );
          }
          polygon.push(index);
        }
        for (let k = 1; k + 1 < n; k++) {
          if (indexCount + 3 > indices.length) {
            const grown = new Uint32Array(Math.max(indices.length * 2, 3));
            grown.set(indices);
            indices = grown;
          }
          indices[indexCount++] = polygon[0];
          indices[indexCount++] = polygon[k];
          indices[indexCount++] = polygon[k + 1];
        }
      }
    }
  };

  try {
    let verticesRead = false;
    let facesRead = !isMesh;
    for (const element of header.elements) {
      if (verticesRead && facesRead) break;
      if (element === vertexElement) {
        readVertices();
        verticesRead = true;
      } else if (isMesh && element === faceElement) {
        readFaces(element);
        facesRead = true;
      } else {
        for (let i = 0; i < element.count; i++) {
          for (const property of element.properties) {
            if (property.countType !== undefined) skipList(reader, property);
            else reader.read(property.type);
          }
        }
      }
    }
  } catch (e) {
    if (e instanceof RangeError) {
      throw new PlyError("truncated", "Unexpected end of file");
    }
    throw e;
  }

  return {
    positions,
    colors,
    hasAlpha,
    normals,
    indices: isMesh ? indices.slice(0, indexCount) : undefined,
    sourceVertexCount: sourceCount
  };
}
