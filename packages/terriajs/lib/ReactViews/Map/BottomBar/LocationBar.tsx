import { observer } from "mobx-react";
import { FC, RefObject, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import MouseCoords from "../../../ReactViewModels/MouseCoords";
import { RawButton } from "../../../Styled/Button";

interface ILocationBarProps {
  mouseCoords: MouseCoords;
}

const ReadoutButton = styled(RawButton)`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  padding: 0 4px;
  border-radius: ${(p) => p.theme.radiusSmall};
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  white-space: nowrap;

  &:hover,
  &:focus-visible {
    background: ${(p) => p.theme.accent};
    color: ${(p) => p.theme.textLight};
  }
`;

const Section = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
`;

const Label = styled.span`
  color: inherit;
`;

const Value = styled.span`
  font-variant-numeric: tabular-nums;
`;

const setInnerText = (ref: RefObject<HTMLElement>, value: string) => {
  if (ref.current) ref.current.innerText = value;
};

export const LocationBar: FC<ILocationBarProps> = observer(
  ({ mouseCoords }) => {
    const { t } = useTranslation();

    const elevationRef = useRef<HTMLElement>(null);
    const longitudeRef = useRef<HTMLElement>(null);
    const latitudeRef = useRef<HTMLElement>(null);
    const utmZoneRef = useRef<HTMLElement>(null);
    const eastRef = useRef<HTMLElement>(null);
    const northRef = useRef<HTMLElement>(null);

    useEffect(() => {
      const disposer = mouseCoords.updateEvent.addEventListener(() => {
        setInnerText(elevationRef, mouseCoords.elevation ?? "");
        setInnerText(longitudeRef, mouseCoords.longitude ?? "");
        setInnerText(latitudeRef, mouseCoords.latitude ?? "");
        setInnerText(utmZoneRef, mouseCoords.utmZone ?? "");
        setInnerText(eastRef, mouseCoords.east ?? "");
        setInnerText(northRef, mouseCoords.north ?? "");
      });
      return disposer;
    });

    return (
      <ReadoutButton type="button" onClick={mouseCoords.toggleUseProjection}>
        {mouseCoords.whereAmI && (
          <Section>
            <Value>{mouseCoords.whereAmI}</Value>
          </Section>
        )}
        {!mouseCoords.useProjection ? (
          <Section>
            <Label>{t(($) => $.sui.statusBar.coords)}:</Label>
            <Value ref={latitudeRef}>{mouseCoords.latitude}</Value>
            <Value ref={longitudeRef}>{mouseCoords.longitude}</Value>
          </Section>
        ) : (
          <>
            <Section>
              <Label>{t(($) => $.legend.zone)}</Label>
              <Value ref={utmZoneRef}>{mouseCoords.utmZone}</Value>
            </Section>
            <Section>
              <Label>{t(($) => $.legend.e)}</Label>
              <Value ref={eastRef}>{mouseCoords.east}</Value>
            </Section>
            <Section>
              <Label>{t(($) => $.legend.n)}</Label>
              <Value ref={northRef}>{mouseCoords.north}</Value>
            </Section>
          </>
        )}
        <Section>
          <Label>{t(($) => $.sui.statusBar.elevation)}:</Label>
          <Value ref={elevationRef}>{mouseCoords.elevation}</Value>
        </Section>
      </ReadoutButton>
    );
  }
);
