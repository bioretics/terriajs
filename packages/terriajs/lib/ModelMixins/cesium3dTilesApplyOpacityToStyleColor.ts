import Color from "terriajs-cesium/Source/Core/Color";
import isDefined from "../Core/isDefined";
import JsonValue, { isJsonObject, JsonArray } from "../Core/Json";

const OPACITY_EXPRESSION = "${opacity}";

/** Single-argument `color('literal')` / `color("literal")` from the 3D Tiles style language. */
const SINGLE_ARG_COLOR_LITERAL = /^color\s*\(\s*(['"])([^'"]*)\1\s*\)\s*$/;

function expressionReferencesOpacity(expr: string): boolean {
  return expr.includes(OPACITY_EXPRESSION);
}

function wrapColorExpression(expr: string): string {
  if (expressionReferencesOpacity(expr)) {
    return expr;
  }

  const cssColor = Color.fromCssColorString(expr);
  if (isDefined(cssColor)) {
    return `color('${expr}', ${OPACITY_EXPRESSION})`;
  }

  const literalColor = expr.match(SINGLE_ARG_COLOR_LITERAL);
  if (literalColor !== null) {
    const quote = literalColor[1];
    const name = literalColor[2];
    return `color(${quote}${name}${quote}, ${OPACITY_EXPRESSION})`;
  }

  // Cesium `color()` expects a string/CSS literal or expression as the first arg, not
  // another Color (nested `color((color('red')), …)` throws at runtime: color.trim is not a function).
  return `color(${expr}, ${OPACITY_EXPRESSION})`;
}

/**
 * Ensures a 3D Tiles style color value uses the `${opacity}` define from
 * {@link Cesium3dTilesStyleMixin.cesiumTileStyle}.
 */
export function applyOpacityToStyleColor(color: unknown): unknown {
  if (!isDefined(color)) {
    return color;
  }

  if (typeof color === "string") {
    return wrapColorExpression(color);
  }

  if (isJsonObject(color)) {
    const result = { ...color };

    if (typeof result.expression === "string") {
      result.expression = wrapColorExpression(result.expression);
    }

    if (Array.isArray(result.conditions)) {
      const conditions = result.conditions as JsonArray;
      result.conditions = conditions.map((entry): JsonValue => {
        if (!Array.isArray(entry) || entry.length < 2) {
          return entry as JsonValue;
        }
        const [condition, colorExpr] = entry;
        return [
          condition as JsonValue,
          applyOpacityToStyleColor(colorExpr) as JsonValue
        ];
      }) as JsonArray;
    }

    return result;
  }

  return color;
}
