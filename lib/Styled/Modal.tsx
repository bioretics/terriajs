import React, { useEffect } from "react";
import styled from "styled-components";
import { Button } from "./Button";
import i18next from "i18next";
import Styles from "../ReactViews/MeasurableGeometry/measurable-panel.scss";
import Icon from "./Icon";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const Overlay = styled.div<{ open: boolean }>`
  display: ${(p) => (p.open ? "block" : "none")};
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: transparent;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  background: ${(p) => p.theme.dark || "#fff"};
  padding: 24px;
  min-width: 300px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  color: ${(p) => p.theme.textLight};
`;

const Body = styled.div`
  flex: 1;
  margin-bottom: 16px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel"
}) => {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  return (
    <Overlay open={open} onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <Header>
          {title && <Title>{title}</Title>}
          <button
            type="button"
            onClick={onClose}
            className={Styles.btnCloseFeature}
            title={i18next.t("general.close")}
          >
            <Icon glyph={Icon.GLYPHS.close} />
          </button>
        </Header>
        <Body>{children}</Body>
        <Footer>
          <Button secondary textLight onClick={onClose}>
            {i18next.t("general.cancel", { defaultValue: cancelText })}
          </Button>
          {onConfirm && (
            <Button primary textLight onClick={onConfirm}>
              {i18next.t("general.confirm", { defaultValue: confirmText })}
            </Button>
          )}
        </Footer>
      </ModalContainer>
    </Overlay>
  );
};

export default Modal;
