import React, { ReactNode, useEffect } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { DialogButton, DialogMutedText } from "./AttributeTableStyles";

interface PropsType {
  title: string;
  /** One line under the title saying what the dialog is about. */
  description?: string;
  /** How wide the dialog may grow, eg. "640px". */
  maxWidth?: string;
  /** Rendered on the left of the footer, beside the close button. */
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

// The attribute table lives in the bottom dock, whose stacking context the
// dialog must escape; it is rendered into document.body and kept above the
// application panels.
const DIALOG_Z_INDEX = 1000000;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: ${DIALOG_Z_INDEX};
  background: rgba(0, 0, 0, 0.45);
`;

const DialogBox = styled.div<{ maxWidth: string }>`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: ${DIALOG_Z_INDEX + 1};
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: calc(100% - 32px);
  max-width: ${(p) => p.maxWidth};
  max-height: 85vh;
  box-sizing: border-box;
  padding: 20px;
  color: ${(p) => p.theme.textBlack};
  background: #fff;
  border-radius: ${(p) => p.theme.radiusLarge};
  box-shadow: 0 6px 6px 0 rgba(0, 0, 0, 0.12), 0 10px 20px 0 rgba(0, 0, 0, 0.05);
  font-family: ${(p) => p.theme.fontBase};
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 24px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.textBlack};
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`;

const CloseCorner = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 18px;
  height: 18px;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border: none;

  svg {
    fill: ${(p) => p.theme.textDark};
  }
`;

/**
 * The modal shell the attribute table's analysis dialogs (column explorer,
 * field statistics, charts) share: a light, centred box over a dimming overlay,
 * closed by the corner button, the footer button, the overlay or Escape.
 */
const AttributeTableDialog: React.FC<PropsType> = (props) => {
  const { title, description, maxWidth = "640px", footer, onClose } = props;
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return ReactDOM.createPortal(
    <>
      <Overlay onClick={onClose} role="presentation" aria-hidden="true" />
      <DialogBox
        maxWidth={maxWidth}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <CloseCorner
          type="button"
          onClick={onClose}
          title={t("general.close")}
          aria-label={t("general.close")}
        >
          <StyledIcon glyph={Icon.GLYPHS.close} styledWidth="14px" />
        </CloseCorner>
        <Header>
          <Title>{title}</Title>
          {description ? (
            <DialogMutedText>{description}</DialogMutedText>
          ) : null}
        </Header>
        <Body>{props.children}</Body>
        <Footer>
          {footer}
          <DialogButton type="button" onClick={onClose}>
            {t("general.close")}
          </DialogButton>
        </Footer>
      </DialogBox>
    </>,
    document.body
  );
};

export default AttributeTableDialog;
