import Color from "terriajs-cesium/Source/Core/Color";
import isDefined from "../Core/isDefined";
import JsonValue, { isJsonObject, JsonArray } from "../Core/Json";

const OPACITY_EXPRESSION = "${opacity}";

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

  return `color((${expr}), ${OPACITY_EXPRESSION})`;
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
