function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Minimal north-arrow symbol: a pointed arrow with an "N" label, transparent background.
const NORTH_ARROW_SVG = `<svg width="32" height="44" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0.5" stdDeviation="0.8" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <text x="16" y="12" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="13" fill="#222" stroke="#fff" stroke-width="2.5" paint-order="stroke">N</text>
    <polygon points="16,16 10,40 16,34 22,40" fill="#222" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    <polygon points="16,16 16,34 22,40" fill="#555"/>
  </g>
</svg>`;

export const NORTH_ARROW_DATA_URI = svgToDataUri(NORTH_ARROW_SVG);

export const BASE_COMPASS_SIZE = 44;
