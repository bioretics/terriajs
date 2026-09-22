/**
 * How the attribute table orders two cell values when a column is sorted.
 * Pure, so the ordering rules can be unit-tested without a table.
 */

/**
 * Compare two attribute values for sorting, ascending.
 *
 * Empty cells sort first, numbers compare numerically (including numbers stored
 * as text, which is how most sources hand them over), and anything else falls
 * back to a locale-aware, case-insensitive comparison with natural number
 * ordering - so "Via 2" comes before "Via 10".
 */
export function compareAttributeValues(a: unknown, b: unknown): number {
  const aBlank = a === null || a === undefined || a === "";
  const bBlank = b === null || b === undefined || b === "";
  if (aBlank && bBlank) return 0;
  if (aBlank) return -1;
  if (bBlank) return 1;

  if (typeof a === "number" && typeof b === "number") return a - b;

  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}
