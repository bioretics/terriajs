import { Ref } from "react";
import { useTranslation } from "react-i18next";
import { runInAction } from "mobx";
import { DefaultTheme } from "styled-components";
import Terria, { LoginProfileServiceType } from "../../../../Models/Terria";
import ViewState from "../../../../ReactViewModels/ViewState";
import Icon from "../../../../Styled/Icon";
import { useRefForTerria } from "../../../Hooks/useRefForTerria";

import Styles from "./login-button.scss";

interface Props {
  terria: Terria;
  theme: DefaultTheme;
  viewState: ViewState;
}

interface ButtonProps extends Props {
  ["aria-expanded"]: boolean;
}

const LOGIN_BUTTON_NAME = "MenuBarLoginButton";

const LoginButton = (props: Props) => {
  const storyButtonRef: Ref<HTMLButtonElement> = useRefForTerria(
    LOGIN_BUTTON_NAME,
    props.viewState
  );

  const onLoginButtonClick = (viewState: ViewState) => () => {
    if (
      props.terria.configParameters.userProfileLoginServiceType ===
      LoginProfileServiceType.Cohesion
    ) {
      const a = document.createElement("a");
      a.href = !viewState.terria.userProfile
        ? viewState.terria.configParameters.userProfileLoginServiceUrl +
          document.baseURI
        : document.baseURI;
      a.click();
    } else if (
      props.terria.configParameters.userProfileLoginServiceType ===
      LoginProfileServiceType.Geoserver
    ) {
      runInAction(() => {
        if (props.terria.userAuthToken) {
          props.terria.userAuthToken = undefined;
        } else {
          viewState.isLoginPanelVisible = true;
        }
      });
    }
  };

  const { t } = useTranslation();

  return (
    <div>
      <button
        ref={storyButtonRef}
        className={Styles.loginBtn}
        type="button"
        onClick={onLoginButtonClick(props.viewState)}
        aria-expanded={!!props.terria.userProfile}
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
        title={
          !props.terria.userAuthToken
            ? t("login.loginTitle")
            : t("login.logoutTitle")
        }
      >
        <Icon glyph={Icon.GLYPHS.user} />
      </button>
    </div>
  );
};
export default LoginButton;
