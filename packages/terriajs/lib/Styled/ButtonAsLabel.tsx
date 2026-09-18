import styled from "styled-components";
import Box from "./Box";

interface IButtonAsLabelProps {
  light?: boolean;
}

// a button styled thing which is actually just a label?
const ButtonAsLabel = styled(Box).attrs((props) => ({
  centered: true,
  styledMinHeight: props.theme.inputHeight || "32px"
}))<IButtonAsLabelProps>`
  border-radius: ${(p) => p.theme.radiusLarge || "16px"};
  background: ${(p) => p.theme.darkTranslucent};
  ${(props) => props.light && ` color: ${props.theme.textDark}; `}
  ${(props) => !props.light && ` color: ${props.theme.textLight}; `}
`;

export default ButtonAsLabel;
