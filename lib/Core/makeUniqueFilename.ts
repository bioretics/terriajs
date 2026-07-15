/**
 * Returns a filename that does not collide with any name in `existingNames`.
 *
 * Examples:
 * - map.geojson -> map_2.geojson
 * - map_2.geojson -> map_3.geojson
 * - map -> map_2
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
