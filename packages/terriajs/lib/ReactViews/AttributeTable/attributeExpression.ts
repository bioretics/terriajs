/**
 * Lightweight field calculator for attribute table edits.
 * Supports basic arithmetic and field references via props["name"] / bare ids.
 */

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const RESERVED_NAMES = new Set([
  "props",
  "$index",
  "Math",
  "Number",
  "String",
  "Boolean",
  "undefined",
  "NaN",
  "Infinity"
]);

export function isBareIdentifier(name: string): boolean {
  return IDENTIFIER_RE.test(name) && !RESERVED_NAMES.has(name);
}

export function fieldReference(name: string): string {
  return isBareIdentifier(name) ? name : `props[${JSON.stringify(name)}]`;
}

export interface CompiledExpression {
  evaluate: (props: Record<string, unknown>, index: number) => unknown;
}

export function compileExpression(
  expression: string,
  fieldNames: string[]
): CompiledExpression {
  const trimmed = expression.trim();
  if (trimmed === "") {
    throw new SyntaxError("Expression is empty.");
  }

  const bareFields = fieldNames.filter(isBareIdentifier);
  const argNames = [...bareFields, "props", "$index", "Math"];

  let fn: (...args: unknown[]) => unknown;
  try {
    // Field calculator evaluates user expressions against row properties.
    // eslint-disable-next-line no-new-func
    fn = new Function(...argNames, `"use strict"; return (${trimmed});`) as (
      ...args: unknown[]
    ) => unknown;
  } catch (error) {
    throw new SyntaxError(
      error instanceof Error ? error.message : "Invalid expression.",
      { cause: error }
    );
  }

  return {
    evaluate(props, index) {
      const fieldValues = bareFields.map((name) => props[name]);
      return fn(...fieldValues, props, index, Math);
    }
  };
}

/**
 * Apply a compiled expression to every row, writing results into `targetField`.
 * Returns a new row array (does not mutate input).
 */
export function calculateField(
  rows: {
    featureId: string;
    rowId: number;
    properties: Record<string, unknown>;
  }[],
  compiled: CompiledExpression,
  targetField: string
): { featureId: string; rowId: number; properties: Record<string, unknown> }[] {
  return rows.map((row, index) => {
    let value: unknown;
    try {
      value = compiled.evaluate(row.properties, index);
    } catch {
      value = null;
    }
    if (typeof value === "number" && !Number.isFinite(value)) value = null;
    return {
      ...row,
      properties: { ...row.properties, [targetField]: value }
    };
  });
}

export function coerceDraftValue(raw: string, preferNumber: boolean): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (preferNumber) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const asNumber = Number(trimmed);
  if (
    preferNumber === false &&
    Number.isFinite(asNumber) &&
    /^-?\d+(\.\d+)?$/.test(trimmed)
  ) {
    // Keep as string unless the column is known numeric — caller decides.
  }
  return trimmed;
}
