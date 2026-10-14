import type { Geometry } from "geojson";
import CorsProxy from "../../Core/CorsProxy";
import loadJson from "../../Core/loadJson";
import { FONTES_FIELDS } from "./fontesFields";

export interface FontesDateRange {
  start: string | undefined;
  end: string | undefined;
}

const DATE = String.raw`[12]\d{3}(?:-(?:1[0-2]|0[1-9])(?:-(?:3[01]|[12]\d|0[1-9]))?)?`;
const SINGLE = new RegExp(`^(${DATE})\\??$`);
const INTERVAL = new RegExp(`^(${DATE})?/(${DATE})?$`);
const IMPRECISE = /^[12]\d[X\d]X$/;

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const existsInCalendar = (date: string) =>
  date.length < 10 ||
  Number(date.slice(8)) <=
    daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)));

const firstDay = (date: string) =>
  date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date;

const lastDay = (date: string) =>
  date.length === 4
    ? `${date}-12-31`
    : date.length === 7
      ? `${date}-${daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5)))}`
      : date;

export function parseFontesDate(text: string): FontesDateRange | undefined {
  const value = text.trim();

  if (IMPRECISE.test(value)) {
    const known = value.replace(/X/g, "");
    return {
      start: `${(known + "000").slice(0, 4)}-01-01`,
      end: `${(known + "999").slice(0, 4)}-12-31`
    };
  }

  const single = SINGLE.exec(value);
  if (single) {
    const [, date] = single;
    if (!existsInCalendar(date)) return undefined;
    return { start: firstDay(date), end: lastDay(date) };
  }

  const interval = INTERVAL.exec(value);
  if (!interval) return undefined;
  const [, from, to] = interval;
  if (!from && !to) return undefined;
  if ((from && !existsInCalendar(from)) || (to && !existsInCalendar(to)))
    return undefined;
  if (from && to && firstDay(to) <= firstDay(from)) return undefined;
  return {
    start: from ? firstDay(from) : undefined,
    end: to ? lastDay(to) : undefined
  };
}

export interface FontesDocument {
  id: string;
  title: string;
  date: FontesDateRange | undefined;
  geometry: Geometry | null;
  properties: Record<string, unknown>;
}

const NOT_AVAILABLE = new Set(["", "N.D", "N.D."]);
const isMissing = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && NOT_AVAILABLE.has(value.trim()));

const MANY_VALUES = new Set(
  FONTES_FIELDS.filter((f) => f.type === "list" || f.type === "objects").map(
    (f) => f.key
  )
);

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {}
  }
  return [value];
}

const TITLE_KEYS = [
  "titolo_originale",
  "titolo_archivista",
  "titolo_schedatore"
];

export function normalizeFontesDocument(feature: any): FontesDocument {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(feature.properties ?? {})) {
    if (isMissing(value)) continue;
    if (MANY_VALUES.has(key)) {
      const values = toArray(value).filter((v) => !isMissing(v));
      if (values.length > 0) properties[key] = values;
    } else {
      properties[key] = value;
    }
  }

  const id = String(properties.id ?? feature.id ?? "");
  const title = TITLE_KEYS.map((key) => properties[key]).find(
    (value): value is string => typeof value === "string"
  );
  const date =
    typeof properties.data_produzione === "string"
      ? parseFontesDate(properties.data_produzione)
      : undefined;

  return {
    id,
    title: title ?? id,
    date,
    geometry: feature.geometry ?? null,
    properties
  };
}

const documentsByUrl = new Map<string, Promise<FontesDocument[]>>();

export function getFontesDocuments(
  url: string,
  corsProxy?: CorsProxy
): Promise<FontesDocument[]> {
  let documents = documentsByUrl.get(url);
  if (!documents) {
    documents = loadJson(corsProxy?.getURLProxyIfNecessary(url) ?? url).then(
      (json) => (json?.features ?? []).map(normalizeFontesDocument)
    );
    documents.catch(() => documentsByUrl.delete(url));
    documentsByUrl.set(url, documents);
  }
  return documents;
}
