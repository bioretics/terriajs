import { observer } from "mobx-react";
import { FC } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import styled, { useTheme } from "styled-components";
import Box from "../../../../../Styled/Box";
import Ul, { Li } from "../../../../../Styled/List";
import Spacing from "../../../../../Styled/Spacing";
import Text from "../../../../../Styled/Text";
import parseCustomHtmlToReact from "../../../../Custom/parseCustomHtmlToReact";
import { parseCustomMarkdownToReactWithOptions } from "../../../../Custom/parseCustomMarkdownToReact";
import CloseButton from "../../../../Generic/CloseButton";
import { PrefaceBox } from "../../../../Generic/PrefaceBox";

interface IDataAttributionModalProps {
  closeModal: () => void;
  attributions: string[];
  searchAttributions: string[];
}

const AttributionText = styled(Text).attrs(() => ({ medium: true }))`
  color: ${(props) => props.theme.modalText};
  a {
    color: ${(props) => props.theme.colorPrimary};
    text-decoration: underline;
    img {
      height: 19px;
      vertical-align: middle;
    }
  }
`;

// Dialog surface (GeoLibre-style), same tokens as the catalogue modal.
const DataAttributionBox = styled(Box).attrs({
  position: "absolute",
  styledWidth: "500px",
  styledMaxHeight: "320px",
  paddedRatio: 4,
  overflowY: "auto",
  scroll: true,
  column: true
})`
  z-index: 99989;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: ${(props) => props.theme.modalBg};
  color: ${(props) => props.theme.modalText};
  border: 1px solid ${(props) => props.theme.border};
  border-radius: ${(props) => props.theme.radiusLarge};
  box-shadow: ${(props) => props.theme.shadowXl};
  @media (max-width: ${(props) => props.theme.mobile}px) {
    width: 100%;
  }
`;

export const DataAttributionModal: FC<IDataAttributionModalProps> = observer(
  ({ closeModal, attributions, searchAttributions }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    if (!attributions || attributions.length === 0) {
      return null;
    }

    return ReactDOM.createPortal(
      <>
        <PrefaceBox
          onClick={closeModal}
          role="presentation"
          aria-hidden="true"
          pseudoBg
          css={{ top: 0, left: 0, zIndex: 99989 }}
        />
        <DataAttributionBox>
          <CloseButton
            color={theme.mutedForeground}
            topRight
            onClick={closeModal}
          />
          <Text extraExtraLarge bold textLight>
            {t(($) => $.map.extraCreditLinks.mapCredits)}
          </Text>
          <Spacing bottom={2} />
          <Box column>
            <Text extraLarge medium textLight>
              {t(($) => $.map.extraCreditLinks.dataProvider)}
            </Text>
            <Spacing bottom={2} />
            <Box paddedHorizontally={4}>
              <ul css={{ padding: 0, margin: 0 }}>
                {attributions.map((attribution, index: number) => (
                  <Li key={index}>
                    <AttributionText>
                      {parseCustomHtmlToReact(attribution)}
                    </AttributionText>
                  </Li>
                ))}
              </ul>
            </Box>
          </Box>
          <Spacing bottom={4} />
          <Box column>
            <Text extraLarge medium textLight>
              {t(($) => $.map.extraCreditLinks.searchProvider)}
            </Text>
            <Spacing bottom={2} />
            <Box paddedHorizontally={4}>
              <Ul css={{ listStyle: "disc" }} column gap={2}>
                {searchAttributions.map((attribution, index: number) => (
                  <Li key={index}>
                    <AttributionText>
                      {parseCustomMarkdownToReactWithOptions(attribution, {
                        inline: true
                      })}
                    </AttributionText>
                  </Li>
                ))}
              </Ul>
            </Box>
          </Box>
        </DataAttributionBox>
      </>,
      document.getElementById("map-data-attribution") || document.body
    );
  }
);
