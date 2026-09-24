/**
 * The look of the attribute table: the dark widgets used by the panel docked at
 * the bottom of the map, and the light ones used inside its dialogs (which
 * follow Terria's modal styling). Kept in one place so the panel, the column
 * explorer, the statistics summary and the charts all read as one feature.
 */

import styled from "styled-components";

/** Height of a table row, in px. The row virtualizer relies on it being fixed. */
export const ROW_HEIGHT = 32;

/** A toolbar button of the docked panel. */
export const PanelButton = styled.button<{ active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  box-sizing: border-box;
  white-space: nowrap;
  cursor: pointer;
  font-family: ${(p) => p.theme.fontBase};
  font-size: 12px;
  color: ${(p) => p.theme.textLight};
  background: ${(p) =>
    p.active ? p.theme.colorPrimary : "rgba(255, 255, 255, 0.1)"};
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${(p) => p.theme.radiusSmall};

  svg {
    width: 13px;
    height: 13px;
    fill: ${(p) => p.theme.textLight};
  }

  &:hover:not(:disabled),
  &:focus:not(:disabled) {
    background: ${(p) => p.theme.colorPrimary};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

/** A square, icon-only variant of {@link PanelButton}. */
export const PanelIconButton = styled(PanelButton)`
  width: 26px;
  padding: 0;
  justify-content: center;
`;

export const PanelInput = styled.input`
  height: 26px;
  min-width: 140px;
  box-sizing: border-box;
  padding: 0 8px;
  font-family: ${(p) => p.theme.fontBase};
  font-size: 12px;
  color: ${(p) => p.theme.textLight};
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${(p) => p.theme.radiusSmall};

  &::placeholder {
    color: ${(p) => p.theme.textLightDimmed};
  }
`;

export const PanelSelect = styled.select`
  height: 26px;
  box-sizing: border-box;
  padding: 0 4px;
  font-family: ${(p) => p.theme.fontBase};
  font-size: 12px;
  color: ${(p) => p.theme.textLight};
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${(p) => p.theme.radiusSmall};

  & option {
    color: ${(p) => p.theme.textBlack};
  }
`;

/** A checkbox and its label, side by side, in the panel toolbar. */
export const PanelCheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  font-size: 12px;
  color: ${(p) => p.theme.textLightDimmed};
  cursor: pointer;
`;

/** Secondary text of the panel (status bar, layer name, hints). */
export const PanelMutedText = styled.span`
  font-size: 11px;
  color: ${(p) => p.theme.textLightDimmed};
`;

/* ------------------------------------------------------------------ *
 * Dialog (light) widgets
 * ------------------------------------------------------------------ */

export const DialogButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  cursor: pointer;
  font-family: ${(p) => p.theme.fontBase};
  font-size: 13px;
  color: ${(p) => p.theme.textDarker};
  background: #fff;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};

  svg {
    width: 14px;
    height: 14px;
    fill: ${(p) => p.theme.textDarker};
  }

  &:hover:not(:disabled),
  &:focus:not(:disabled) {
    border-color: ${(p) => p.theme.colorPrimary};
    color: ${(p) => p.theme.colorPrimary};
    svg {
      fill: ${(p) => p.theme.colorPrimary};
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const DialogInput = styled.input`
  height: 30px;
  box-sizing: border-box;
  padding: 0 8px;
  font-family: ${(p) => p.theme.fontBase};
  font-size: 13px;
  color: ${(p) => p.theme.textBlack};
  background: #fff;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};
`;

export const DialogSelect = styled.select`
  height: 30px;
  box-sizing: border-box;
  padding: 0 4px;
  font-family: ${(p) => p.theme.fontBase};
  font-size: 13px;
  color: ${(p) => p.theme.textBlack};
  background: #fff;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};
`;

/** A form control with its label stacked above it. */
export const DialogField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const DialogLabel = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: ${(p) => p.theme.textDarker};
`;

export const DialogMutedText = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.textDark};
`;

/** A field name, a value or any other text better read in a fixed pitch. */
export const MonoText = styled.span`
  font-family: ${(p) => p.theme.fontMono};
  font-variant-numeric: tabular-nums;
`;

/** The track and fill of the small proportional bars used in the dialogs. */
export const BarTrack = styled.div`
  flex: 1;
  min-width: 1px;
  height: 8px;
  overflow: hidden;
  border-radius: 2px;
  background: ${(p) => p.theme.greyLighter2};
`;

export const BarFill = styled.div<{ ratio: number }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(1, p.ratio)) * 100}%;
  background: ${(p) => p.theme.colorPrimary};
`;
