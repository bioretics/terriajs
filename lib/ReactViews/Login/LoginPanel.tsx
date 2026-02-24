import classNames from "classnames";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "styled-components";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import Box from "../../Styled/Box";
import Button from "../../Styled/Button";
import Input from "../../Styled/Input";
import Text from "../../Styled/Text";
import Styles from "./login-panel.scss";

const DragWrapper = require("../DragWrapper");

interface Props {
  terria: Terria;
  viewState: ViewState;
  onClose?: () => void;
}

const LoginPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  const [username, setUsername] = useState<string>();
  const [password, setPassword] = useState<string>();

  const USERNAME_KEY = "usrnm";
  const PASSWORD_KEY = "psswrd";

  const theme = useTheme();

  const { t } = useTranslation();

  const panelClassName = classNames(Styles.panel, {
    [Styles.isVisible]: viewState.isLoginPanelVisible
  });

  const doLogin = () => {
    if (username) {
      localStorage.setItem(USERNAME_KEY, username);
    } else {
      localStorage.removeItem(USERNAME_KEY);
    }
    if (password) {
      localStorage.setItem(PASSWORD_KEY, password);
    } else {
      localStorage.removeItem(PASSWORD_KEY);
    }
  };

  const cancel = () => {
    runInAction(() => {
      viewState.isLoginPanelVisible = false;
    });
  };

  useEffect(() => {
    setUsername(localStorage.getItem(USERNAME_KEY) ?? undefined);
    setPassword(localStorage.getItem(PASSWORD_KEY) ?? undefined);
  }, []);

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.isLoginPanelVisible}
      >
        <div className={Styles.header}>
          <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
            <span style={{ display: "flex", justifyContent: "center" }}>
              <b>{t("login.loginPanelHeader")}</b>
            </span>
          </div>
        </div>
        <div className={Styles.body}>
          <Text
            textLight
            style={{ textAlign: "center" }}
            title={t("login.loginPanelUsernameTitle")}
          >
            {t("login.loginPanelUsername")}
          </Text>
          <Input
            title=""
            required
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
            }}
          />
          <br />
          <Text
            textLight
            style={{ textAlign: "center" }}
            title={t("login.loginPanelPasswordTitle")}
          >
            {t("login.loginPanelPassword")}
          </Text>
          <Input
            title=""
            required
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
          />
          <Box>
            <Button
              primary
              shortMinHeight
              onClick={doLogin}
              style={{ fontSize: "0.8em", padding: "2px 10px", margin: "7px" }}
            >
              {t("login.loginPanelOk")}
            </Button>
            <Button
              secondary
              shortMinHeight
              onClick={cancel}
              style={{ fontSize: "0.8em", padding: "2px 10px", margin: "7px" }}
            >
              {t("login.loginPanelCancel")}
            </Button>
          </Box>
        </div>
      </div>
    </DragWrapper>
  );
});

export default LoginPanel;
