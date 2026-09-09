import { createGlobalStyle } from "styled-components";
import Color from "terriajs-cesium/Source/Core/Color";

export const GlobalTerriaStyles = createGlobalStyle`
body {
  font-family: ${(p) => p.theme.fontBase};
  background: ${(p) => p.theme.dark};
  color: ${(p) => p.theme.textLight};

  // Keyboard focus ring: visible only for keyboard navigation, in the accent
  // colour and offset like GeoLibre's :focus-visible rule.
  *:focus-visible {
    outline: 2px solid ${(p) => p.theme.ring};
    outline-offset: 2px;
  }
  *:focus:not(:focus-visible) {
    outline: none;
  }
}

button,
input,
select,
textarea {
  font-family: inherit;
}

// Theme-ify sass classes until they are removed

// We override the primary, secondary, map and share buttons here as they
// are imported everywhere and used in various ways - until we remove sass
// this is the quickest way to tackle them for now
.tjs-_buttons__btn--map {
  ${(p) => p.theme.addTerriaMapBtnStyles(p)}
}

.tjs-_buttons__btn-primary {
  ${(p) => p.theme.addTerriaPrimaryBtnStyles(p)}
}

.tjs-_buttons__btn--secondary,
.tjs-_buttons__btn--close-modal {
  ${(p) => p.theme.addTerriaSecondaryBtnStyles(p)}
}

.tjs-_buttons__btn--tertiary {
  ${(p) => p.theme.addTerriaTertiaryBtnStyles(p)}
}

.tjs-_buttons__btn-small:hover,
.tjs-_buttons__btn-small:focus {
  color: ${(p) => p.theme.colorPrimary};
}

.tjs-share-panel__catalog-share-inner {
  background: ${(p) => p.theme.popover};
}

.tjs-share-panel__btn--catalogShare {
  color: ${(p) => p.theme.colorPrimary};
  background:transparent;
  svg {
    fill: ${(p) => p.theme.colorPrimary};
  }
}
.tjs-dropdown__btn--dropdown {
  color: ${(p) => p.theme.textLight};
  background: ${(p) => p.theme.popover};
  border: 1px solid ${(p) => p.theme.inputBorder};
  &:hover,
  &:focus {
    color: ${(p) => p.theme.textLight};
    background: ${(p) => p.theme.popover};
    border: 1px solid ${(p) => p.theme.colorPrimary};
  }
  svg {
    fill: ${(p) => p.theme.textLight};
  }
}
.tjs-dropdown__btn--option.tjs-dropdown__is-selected {
  color: ${(p) => p.theme.colorPrimary};
}

button {
  cursor: pointer;
}

.selection-indicator {
  pointer-events: none;
  position: absolute;
  width: 50px;
  height: 50px;
}

.cesium-widget,
.cesium-widget canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  touch-action: none;
}

// Global theme variables (also usable from plain CSS / SCSS at runtime)
:root {
  --theme-background: ${(p) => p.theme.dark};
  --theme-card: ${(p) => p.theme.card};
  --theme-popover: ${(p) => p.theme.popover};
  --theme-muted: ${(p) => p.theme.muted};
  --theme-accent: ${(p) => p.theme.accent};
  --theme-border: ${(p) => p.theme.border};
  --theme-input-border: ${(p) => p.theme.inputBorder};
  --theme-foreground: ${(p) => p.theme.textLight};
  --theme-muted-foreground: ${(p) => p.theme.mutedForeground};
  --theme-primary: ${(p) => p.theme.colorPrimary};
  --theme-ring: ${(p) => p.theme.ring};
  --theme-radius-md: ${(p) => p.theme.radiusMedium};
  --theme-radius-lg: ${(p) => p.theme.radiusLarge};

  // Derive transparent dark from dark theme color and alpha
  --theme-transparent-dark: ${(p) =>
    Color.fromCssColorString(p.theme.dark)
      ?.withAlpha(parseFloat(p.theme.darkAlpha))
      .toCssHexString() ?? p.theme.dark}
}
`;
