import styled from "styled-components";
import Box from "../../Styled/Box";
import { TOUR_WIDTH } from "./tour-helpers";
// TODO: make relative to app z-index
export const TourExplanationBoxZIndex = 10000;

export const TourExplanationBox = styled(Box)<{ longer?: boolean }>`
  position: absolute;
  width: ${(p) => (p.longer ? `${TOUR_WIDTH + 55}` : `${TOUR_WIDTH}`)}px;
  // background-color: $modal-bg;
  z-index: ${TourExplanationBoxZIndex};
  background: ${(p) => p.theme.modalBg || "white"};
  // color: ${(p) => p.theme.textDarker};

  min-height: 136px;
  border-radius: ${(p) => p.theme.radiusLarge || "4px"};

  box-shadow: ${(p) => p.theme.shadowLg};

  // extend parseCustomMarkdownToReact() to inject our <Text /> with relevant props to cut down on # of styles?
  // Force styling from markdown?
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    padding: 0;
  }
  h1,
  h2,
  h3 {
    margin-bottom: ${(p) => (Number(p.theme.spacing) || 5) * 3}px;
    font-size: 16px;
    font-weight: bold;
  }
  h4,
  h5,
  h6 {
    font-size: 15px;
  }

  p {
    margin: 0;
    margin-bottom: ${(p) => p.theme.spacing}px;
  }
  p:last-child {
    margin-bottom: 0;
  }
`;

export default TourExplanationBox;
