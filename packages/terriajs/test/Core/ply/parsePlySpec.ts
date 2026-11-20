import loadArrayBuffer from "../../../lib/Core/loadArrayBuffer";
import { parsePly, PlyError } from "../../../lib/Core/ply/parsePly";

function load(name: string) {
  return loadArrayBuffer(`test/ply/${name}`);
}

function bufferFrom(text: string) {
  return new TextEncoder().encode(text).buffer;
}

function expectPlyError(fn: () => unknown, code: string) {
  try {
    fn();
    fail("Expected a PlyError");
  } catch (e) {
    expect(e instanceof PlyError).toBeTrue();
    expect((e as PlyError).code).toBe(code);
  }
}

describe("parsePly", function () {
  it("parses an ASCII mesh with colours, triangulating quad faces", async function () {
    const data = parsePly(await load("mesh-ascii-colors.ply"));
    expect(data.positions.length).toBe(8 * 3);
    expect(Array.from(data.positions.slice(0, 6))).toEqual([0, 0, 0, 1, 0, 0]);
    expect(Array.from(data.colors!.slice(0, 8))).toEqual([
      255, 0, 0, 255, 0, 255, 0, 255
    ]);
    expect(data.hasAlpha).toBeFalse();
    expect(data.normals).toBeUndefined();
    expect(data.indices!.length).toBe(36);
    expect(Array.from(data.indices!.slice(0, 6))).toEqual([0, 3, 2, 0, 2, 1]);
  });

  it("parses an ASCII mesh without colours or normals and with CRLF line endings", async function () {
    const data = parsePly(await load("mesh-ascii-nocolors.ply"));
    expect(Array.from(data.positions)).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 0]);
    expect(data.colors).toBeUndefined();
    expect(data.normals).toBeUndefined();
    expect(Array.from(data.indices!)).toEqual([0, 1, 2]);
  });

  it("parses a binary little endian point cloud with normals and alpha", async function () {
    const data = parsePly(await load("points-binary-le.ply"));
    expect(data.indices).toBeUndefined();
    expect(Array.from(data.positions)).toEqual([
      0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10
    ]);
    expect(Array.from(data.normals!.slice(0, 3))).toEqual([0, 0, 2]);
    expect(data.hasAlpha).toBeTrue();
    expect(Array.from(data.colors!.slice(4, 8))).toEqual([50, 100, 200, 128]);
  });

  it("parses a binary big endian point cloud, skipping unknown elements with lists", async function () {
    const data = parsePly(await load("points-binary-be.ply"));
    expect(data.sourceVertexCount).toBe(5);
    expect(data.colors).toBeUndefined();
    expect(Array.from(data.positions.slice(3, 9))).toEqual([
      1, -1, 0.5, 2, -2, 1
    ]);
  });

  it("keeps full precision of large coordinates and converts float colours", async function () {
    const data = parsePly(await load("points-utm-ascii.ply"));
    expect(data.positions[0]).toBe(686000.125);
    expect(data.positions[1]).toBe(4929000.25);
    expect(Array.from(data.colors!.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(data.colors![10]).toBe(128);
  });

  it("decimates point clouds above maximumPoints", async function () {
    const data = parsePly(await load("points-binary-be.ply"), {
      maximumPoints: 2
    });
    expect(data.sourceVertexCount).toBe(5);
    expect(data.positions.length).toBe(2 * 3);
    expect(Array.from(data.positions.slice(3, 6))).toEqual([3, -3, 1.5]);
  });

  it("never decimates meshes", async function () {
    const data = parsePly(await load("mesh-ascii-colors.ply"), {
      maximumPoints: 2
    });
    expect(data.positions.length).toBe(8 * 3);
  });

  it("rejects an unknown format", async function () {
    const buffer = await load("invalid-header.ply");
    expectPlyError(() => parsePly(buffer), "invalidHeader");
  });

  it("rejects files that are not PLY", function () {
    expectPlyError(
      () => parsePly(bufferFrom("solid cube\nfacet normal 0 0 1\n")),
      "invalidHeader"
    );
  });

  it("rejects truncated files", async function () {
    const buffer = await load("truncated.ply");
    expectPlyError(() => parsePly(buffer), "truncated");
  });

  it("rejects files without vertices", function () {
    expectPlyError(
      () =>
        parsePly(
          bufferFrom(
            "ply\nformat ascii 1.0\nelement vertex 0\nproperty float x\nproperty float y\nproperty float z\nend_header\n"
          )
        ),
      "noVertices"
    );
  });

  it("rejects faces referencing missing vertices", function () {
    expectPlyError(
      () =>
        parsePly(
          bufferFrom(
            "ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 5\n"
          )
        ),
      "invalidData"
    );
  });

  it("rejects non numeric ASCII values", function () {
    expectPlyError(
      () =>
        parsePly(
          bufferFrom(
            "ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 abc 0\n"
          )
        ),
      "invalidData"
    );
  });
});
