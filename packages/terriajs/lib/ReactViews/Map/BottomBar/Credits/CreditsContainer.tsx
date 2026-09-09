import styled from "styled-components";
import Box from "../../../../Styled/Box";

// Credits live in the docked status bar: inherit its muted monospace text.
export const CreditsContainer = styled(Box).attrs(() => ({
  styledHeight: "100%",
  verticalCenter: true,
  gap: true
}))`
  flex-shrink: 0;
  min-width: 0;
  font-size: inherit;
  color: inherit;
  a {
    text-decoration: none;
    cursor: pointer;
    color: inherit;
    display: flex;
    align-items: center;
    &:hover,
    &:focus-visible {
      color: ${(props) => props.theme.textLight};
      text-decoration: underline;
    }
  }
  img {
    height: 18px;
  }
`;
