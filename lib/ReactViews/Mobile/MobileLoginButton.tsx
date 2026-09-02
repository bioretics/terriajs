import classNames from "classnames";
import { observer } from "mobx-react";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { useLogin } from "../Map/MenuBar/LoginButton/useLogin";

import Styles from "./mobile-login-button.scss";

interface Props {
  terria: Terria;
  viewState: ViewState;
}

const MobileLoginButton = observer((props: Props) => {
  const { t } = useTranslation();
  const { isLoggedIn, username, executeAuthAction } = useLogin(
    props.terria,
    props.viewState
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);

  useEffect(() => {
    if (!isLogoutConfirmVisible) return;

    const handleOutsideClick = (event: Event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsLogoutConfirmVisible(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [isLogoutConfirmVisible]);

  useEffect(() => {
    if (!isLoggedIn && isLogoutConfirmVisible) {
      setIsLogoutConfirmVisible(false);
    }
  }, [isLoggedIn, isLogoutConfirmVisible]);

  const onLoginButtonClick = () => {
    if (isLoggedIn) {
      setIsLogoutConfirmVisible((visible) => !visible);
      return;
    }
    executeAuthAction();
  };

  const onConfirmLogout = () => {
    setIsLogoutConfirmVisible(false);
    executeAuthAction();
  };

  return (
    <div className={Styles.loginContainer} ref={containerRef}>
      <button
        type="button"
        className={classNames(Styles.loginBtn, {
          [Styles.loginBtnActive]: isLoggedIn
        })}
        onClick={onLoginButtonClick}
        aria-expanded={isLoggedIn && isLogoutConfirmVisible}
        title={!isLoggedIn ? t("login.loginTitle") : t("login.logoutTitle")}
      >
        <StyledIcon
          glyph={isLoggedIn ? Icon.GLYPHS.logout : Icon.GLYPHS.user}
          styledWidth="20px"
          styledHeight="20px"
        />
      </button>
      {isLoggedIn && isLogoutConfirmVisible && (
        <div
          className={Styles.logoutConfirmPanel}
          role="dialog"
          aria-modal={false}
          aria-label={t("login.logoutConfirmTitle")}
        >
          <div className={Styles.logoutConfirmMessage}>
            <Trans
              i18nKey="login.logoutConfirmMessage"
              values={{ username }}
              components={[<strong key="username" />]}
            />
          </div>
          <div className={Styles.logoutConfirmActions}>
            <button
              type="button"
              className={Styles.logoutConfirmBtn}
              onClick={onConfirmLogout}
            >
              {t("login.logoutConfirmOk")}
            </button>
            <button
              type="button"
              className={Styles.logoutCancelBtn}
              onClick={() => setIsLogoutConfirmVisible(false)}
            >
              {t("login.logoutConfirmCancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
export default MobileLoginButton;
