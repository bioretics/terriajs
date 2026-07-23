/**
 * Returns a filename that does not collide with any name in `existingNames`.
 * Inserts `_N` before the extension (or at the end if there is none).
 *
 * For display names like "map.geojson (copy)", use {@link makeUniqueName} instead.
 */
export default function makeUniqueFilename(
  filename: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(filename)) {
    return filename;
  }

  const dotIndex = filename.lastIndexOf(".");
  const baseName = dotIndex === -1 ? filename : filename.slice(0, dotIndex);
  const extension = dotIndex === -1 ? "" : filename.slice(dotIndex);

  let suffix = 2;
  let candidate = `${baseName}_${suffix}${extension}`;

  while (existingNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName}_${suffix}${extension}`;
  }

  return candidate;
}

/**
 * Returns a display name that does not collide with any name in `existingNames`.
 * Does not split on `.`; appends ` 1`, ` 2`, …
 */
export function makeUniqueName(
  name: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(name)) {
    return name;
  }

  let suffix = 1;
  let candidate = `${name} ${suffix}`;

  while (existingNames.has(candidate)) {
    suffix += 1;
    candidate = `${name} ${suffix}`;
  }

  return candidate;
}
