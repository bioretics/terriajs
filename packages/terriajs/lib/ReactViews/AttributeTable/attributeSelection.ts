/**
 * Pure row-selection logic for the attribute table (ported from GeoLibre).
 */

export interface RowSelectionInput {
  featureId: string;
  sortedIds: string[];
  selectedIds: string[];
  anchorId: string | null;
  additive: boolean;
  range: boolean;
}

export interface RowSelectionResult {
  ids: string[];
  anchor: string | null;
}

/**
 * Compute the next selection for a modifier-aware row click.
 *
 * - plain click: select just the clicked row
 * - Ctrl/Cmd click: toggle the clicked row
 * - Shift click: select contiguous range from the anchor
 * - Shift+Ctrl: merge range into existing selection
 */
export function computeRowSelection(
  input: RowSelectionInput
): RowSelectionResult {
  const { featureId, sortedIds, selectedIds, anchorId, additive, range } =
    input;

  if (range) {
    const anchorIndex =
      anchorId !== null && anchorId !== undefined
        ? sortedIds.indexOf(anchorId)
        : -1;
    const clickedIndex = sortedIds.indexOf(featureId);
    if (anchorIndex === -1 || clickedIndex === -1) {
      return { ids: [featureId], anchor: featureId };
    }
    const [from, to] =
      anchorIndex <= clickedIndex
        ? [anchorIndex, clickedIndex]
        : [clickedIndex, anchorIndex];
    const rangeIds = sortedIds.slice(from, to + 1);
    const merged = additive ? [...selectedIds, ...rangeIds] : rangeIds;
    return { ids: [...new Set(merged)], anchor: anchorId };
  }

  if (additive) {
    const next = selectedIds.includes(featureId)
      ? selectedIds.filter((id) => id !== featureId)
      : [...selectedIds, featureId];
    const anchor = next.includes(featureId)
      ? featureId
      : anchorId !== null && anchorId !== undefined && next.includes(anchorId)
        ? anchorId
        : (next[next.length - 1] ?? null);
    return { ids: next, anchor };
  }

  return { ids: [featureId], anchor: featureId };
}
