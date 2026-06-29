import React, { useEffect, useRef, useState } from "react";
import i18next from "i18next";
import { useTheme } from "styled-components";
import Button from "../../Styled/Button";
import Icon, { StyledIcon } from "../../Styled/Icon";

export type MeasurableInfoKind = "circle" | "polygonGeo" | "polygonAir";

interface MeasurableInfoPanelProps {
  kind: MeasurableInfoKind;
  disabled?: boolean;
}

const TITLE_KEYS: Record<MeasurableInfoKind, string> = {
  circle: "measurableGeometry.areaInfo.circleTitle",
  polygonGeo: "measurableGeometry.areaInfo.polygonGeoTitle",
  polygonAir: "measurableGeometry.areaInfo.polygonAirTitle"
};

const DESC_KEYS: Record<MeasurableInfoKind, string> = {
  circle: "measurableGeometry.areaInfo.circleDesc",
  polygonGeo: "measurableGeometry.areaInfo.polygonGeoDesc",
  polygonAir: "measurableGeometry.areaInfo.polygonAirDesc"
};

const MeasurableInfoPanel: React.FC<MeasurableInfoPanelProps> = ({
  kind,
  disabled = false
}) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center"
      }}
    >
      <Button
        disabled={disabled}
        css={`
          background-color: transparent;
          border: none;
          width: 20px;
          height: 20px;
          min-width: 20px;
          min-height: 20px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s;
          &:hover:not(:disabled) {
            opacity: 0.75;
          }
        `}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title={i18next.t("measurableGeometry.areaInfo.title")}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <StyledIcon realDark glyph={Icon.GLYPHS.helpThick} styledWidth="14px" />
      </Button>

      {isOpen && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: theme.dark,
            border: `1px solid ${theme.textLight}33`,
            borderRadius: "6px",
            padding: "12px 14px",
            minWidth: "240px",
            maxWidth: "300px",
            zIndex: 9999,
            boxShadow: "0 6px 20px rgba(0,0,0,0.55)",
            whiteSpace: "normal",
            textAlign: "left",
            pointerEvents: "auto"
          }}
        >
          <p
            style={{
              fontWeight: 700,
              fontSize: "0.82em",
              margin: "0 0 7px 0",
              color: theme.textLight,
              letterSpacing: "0.02em"
            }}
          >
            {i18next.t(TITLE_KEYS[kind])}
          </p>

          <p
            style={{
              fontSize: "0.78em",
              lineHeight: 1.55,
              margin: 0,
              color: `${theme.textLight}bb`
            }}
          >
            {i18next.t(DESC_KEYS[kind])}
          </p>

          <div
            style={{
              position: "absolute",
              bottom: -7,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: `7px solid ${theme.dark}`
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -9,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: `8px solid ${theme.textLight}33`,
              zIndex: -1
            }}
          />
        </div>
      )}
    </div>
  );
};

export default MeasurableInfoPanel;
