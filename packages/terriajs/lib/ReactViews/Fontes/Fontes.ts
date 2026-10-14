import booleanIntersects from "@turf/boolean-intersects";
import type { FeatureCollection, Geometry } from "geojson";
import Papa from "papaparse";
import CorsProxy from "../../Core/CorsProxy";
import { sanitizeCsvValue } from "../../Core/sanitizeCsv";
import loadJson from "../../Core/loadJson";
import { FONTES_FIELDS, FontesField, FontesFieldType } from "./fontesFields";

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

export const ALL_FIELDS = "*";

export type FontesOperator =
  | "contains"
  | "equals"
  | "lt"
  | "gt"
  | "true"
  | "false"
  | "period";

export type FontesLogic = "AND" | "OR" | "AND NOT";

export interface FontesCondition {
  field: string;
  operator: FontesOperator;
  value: string;
  logic: FontesLogic;
}

export interface FontesFilter {
  conditions: FontesCondition[];
  period?: { from?: number; to?: number };
  area?: Geometry;
}

export const OPERATORS: Record<FontesFieldType, FontesOperator[]> = {
  text: ["contains", "equals"],
  list: ["contains", "equals"],
  objects: ["contains", "equals"],
  number: ["equals", "lt", "gt"],
  bool: ["true", "false"],
  date: ["period"]
};

const NUMBER_FIELDS = new Set(
  FONTES_FIELDS.filter((f) => f.type === "number").map((f) => f.key)
);
const TEXT_FIELDS = FONTES_FIELDS.filter(
  (f) => f.type !== "number" && f.type !== "bool"
).map((f) => f.key);

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function textValues(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (typeof value === "object")
    return Object.values(value).flatMap(textValues);
  return [String(value)];
}

const overlaps = (a: FontesDateRange, b: FontesDateRange) =>
  (a.start === undefined || b.end === undefined || a.start <= b.end) &&
  (a.end === undefined || b.start === undefined || a.end >= b.start);

function matches(doc: FontesDocument, condition: FontesCondition): boolean {
  const { field, operator, value } = condition;
  if (operator === "true" || operator === "false") {
    return doc.properties[field] === (operator === "true");
  }
  if (operator === "period") {
    const period = parseFontesDate(value);
    return !!period && !!doc.date && overlaps(doc.date, period);
  }
  if (NUMBER_FIELDS.has(field)) {
    const actual = doc.properties[field];
    const expected = Number(value);
    if (typeof actual !== "number" || isNaN(expected)) return false;
    return operator === "lt"
      ? actual < expected
      : operator === "gt"
        ? actual > expected
        : actual === expected;
  }
  const wanted = fold(value);
  return (field === ALL_FIELDS ? TEXT_FIELDS : [field]).some((key) =>
    textValues(doc.properties[key]).some((text) =>
      operator === "equals"
        ? fold(text) === wanted
        : fold(text).includes(wanted)
    )
  );
}

const isActive = (condition: FontesCondition) =>
  condition.operator === "true" ||
  condition.operator === "false" ||
  condition.value.trim() !== "";

const year = (value: number) => String(value).padStart(4, "0");

export function filterDocuments(
  docs: FontesDocument[],
  { conditions, period, area }: FontesFilter
): FontesDocument[] {
  const rows = conditions.filter(isActive);
  const years: FontesDateRange | undefined =
    period?.from !== undefined || period?.to !== undefined
      ? {
          start:
            period.from !== undefined
              ? `${year(period.from)}-01-01`
              : undefined,
          end: period.to !== undefined ? `${year(period.to)}-12-31` : undefined
        }
      : undefined;

  return docs.filter((doc) => {
    if (years && !(doc.date && overlaps(doc.date, years))) return false;
    if (area && !(doc.geometry && booleanIntersects(doc.geometry, area))) {
      return false;
    }
    if (rows.length === 0) return true;
    return rows.slice(1).reduce(
      (result, row, i) => {
        const match = matches(doc, row);
        const logic = rows[i].logic;
        return logic === "OR"
          ? result || match
          : logic === "AND NOT"
            ? result && !match
            : result && match;
      },
      matches(doc, rows[0])
    );
  });
}

export function distinctValues(
  docs: FontesDocument[],
  field: string
): string[] {
  if (field === ALL_FIELDS) return [];
  const values = new Set(
    docs.flatMap((doc) => textValues(doc.properties[field]))
  );
  return [...values].sort((a, b) => a.localeCompare(b, "it"));
}

const CALENDAR_START = "1000-01-01";
const CALENDAR_END = "2999-12-31";

export function toResultsGeoJson(docs: FontesDocument[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: docs
      .filter((doc) => doc.geometry)
      .map((doc) => ({
        type: "Feature" as const,
        geometry: doc.geometry!,
        properties: {
          id: doc.id,
          titolo: doc.title,
          segnatura: doc.properties.segnatura,
          data_produzione: doc.properties.data_produzione,
          data_da: doc.date && (doc.date.start ?? CALENDAR_START),
          data_a: doc.date && (doc.date.end ?? CALENDAR_END),
          tipo: doc.properties.documento_testuale
            ? "Documento testuale"
            : "Mappa"
        }
      }))
  };
}

function cellText(field: FontesField, value: unknown): string {
  if (value === undefined || value === null) return "";
  if (field.type === "bool") return value ? "Sì" : "No";
  if (field.type === "list") return textValues(value).join(", ");
  if (field.type === "objects") {
    return (value as unknown[])
      .map((record) => textValues(record).join(" "))
      .join("; ");
  }
  return String(value);
}

export function toCsv(docs: FontesDocument[]): string {
  return (
    "﻿" +
    Papa.unparse(
      {
        fields: FONTES_FIELDS.map((field) => field.label),
        data: docs.map((doc) =>
          FONTES_FIELDS.map((field) =>
            sanitizeCsvValue(cellText(field, doc.properties[field.key]))
          )
        )
      },
      { delimiter: ";" }
    )
  );
}
