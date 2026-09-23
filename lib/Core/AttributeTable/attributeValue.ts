/**
 * How the attribute table turns a raw property value into the text it shows.
 * Shared by the table cells, the CSV export and the analyses (statistics,
 * column explorer, chart categories), so one value reads the same everywhere it
 * appears - a GeoJSON property holding an object or a list included.
 */

/**
 * The display text of an attribute value. Nullish values become an empty
 * string; objects and arrays are stringified as JSON, because a GeoJSON
 * property is free to hold either and `String(value)` would collapse every
 * object into "[object Object]".
 */
export function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
