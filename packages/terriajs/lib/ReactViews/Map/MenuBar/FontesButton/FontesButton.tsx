import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import { DefaultTheme } from "styled-components";
import Terria from "../../../../Models/Terria";
import ViewState from "../../../../ReactViewModels/ViewState";
import Icon from "../../../../Styled/Icon";

import Styles from "./fontes-button.scss";

interface Props {
  terria: Terria;
  theme: DefaultTheme;
  viewState: ViewState;
}

interface ButtonProps extends Props {
  ["aria-expanded"]: boolean;
}

const FontesButton = observer((props: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <button
        className={Styles.fontesBtn}
        type="button"
        onClick={() => {
          props.viewState.toggleFontesPanel();
          props.terria.currentViewer.notifyRepaintRequired();
        }}
        aria-expanded={props.viewState.fontesPanelShown}
        css={`
          ${(p: ButtonProps) =>
            p["aria-expanded"] &&
            `&:not(.foo) {
                      background: ${p.theme.colorPrimary};
                      svg {
                        fill: ${p.theme.textLight};
                      }
                    }`}
        `}
      >
        <Icon glyph={Icon.GLYPHS.map} />
        <span>{t(($) => $.fontes.menuButton)}</span>
      </button>
    </div>
  );
});

export default FontesButton;
