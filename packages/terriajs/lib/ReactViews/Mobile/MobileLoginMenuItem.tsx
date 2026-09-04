import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Trans, useTranslation } from "react-i18next";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import { useLogin } from "../Map/MenuBar/LoginButton/useLogin";
import MobileMenuItem from "./MobileMenuItem";

import Styles from "./mobile-login-menu-item.scss";

interface Props {
  terria: Terria;
  viewState: ViewState;
  closeMenu: () => void;
}

const MobileLoginMenuItem = observer((props: Props) => {
  const { t } = useTranslation();
  const { isLoggedIn, username, executeAuthAction } = useLogin(
    props.terria,
    props.viewState
  );
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);

  useEffect(() => {
    if (!isLoggedIn && isLogoutConfirmVisible) {
      setIsLogoutConfirmVisible(false);
    }
  }, [isLoggedIn, isLogoutConfirmVisible]);

  const onMenuItemClick = () => {
    if (isLoggedIn) {
      setIsLogoutConfirmVisible((visible) => !visible);
      return;
    }
    props.closeMenu();
    executeAuthAction();
  };

  const onConfirmLogout = () => {
    setIsLogoutConfirmVisible(false);
    props.closeMenu();
    executeAuthAction();
  };

  return (
    <>
      <MobileMenuItem.Button onClick={onMenuItemClick}>
        {isLoggedIn
          ? t(($) => $.login.logoutTitle)
          : t(($) => $.login.loginTitle)}
      </MobileMenuItem.Button>
      {isLoggedIn && isLogoutConfirmVisible && (
        <div
          className={Styles.logoutConfirm}
          role="dialog"
          aria-modal={false}
          aria-label={t(($) => $.login.logoutConfirmTitle)}
        >
          <div className={Styles.logoutConfirmMessage}>
            <Trans
              i18nKey={($) => $.login.logoutConfirmMessage}
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
              {t(($) => $.login.logoutConfirmOk)}
            </button>
            <button
              type="button"
              className={Styles.logoutCancelBtn}
              onClick={() => setIsLogoutConfirmVisible(false)}
            >
              {t(($) => $.login.logoutConfirmCancel)}
            </button>
          </div>
        </div>
      )}
    </>
  );
});
export default MobileLoginMenuItem;
