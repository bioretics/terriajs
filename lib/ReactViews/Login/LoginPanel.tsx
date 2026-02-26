import classNames from "classnames";
import { action, runInAction } from "mobx";
import { observer } from "mobx-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
//import { useTheme } from "styled-components";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import loadJson from "../../Core/loadJson";
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

  //const theme = useTheme();

  const { t } = useTranslation();

  const panelClassName = classNames(Styles.panel, {
    [Styles.isVisible]: viewState.isLoginPanelVisible
  });

  const doLogin = action(async () => {
    if (terria.userAuthToken) {
      terria.userAuthToken = undefined;
    } else if (
      terria.configParameters.userProfileLoginServiceUrl &&
      username &&
      password
    ) {
      const header = `Basic ${Buffer.from(`${username}:${password}`).toString(
        "base64"
      )}`;
      const res = await loadJson(
        terria.corsProxy.getURLProxyIfNecessary(
          terria.configParameters.userProfileLoginServiceUrl
        ),
        { headers: { Authorization: header } }
      );

      if (res) {
        terria.userAuthToken = header;
      }
    }
    viewState.isLoginPanelVisible = false;
  });

  const cancel = () => {
    runInAction(() => {
      viewState.isLoginPanelVisible = false;
    });
  };

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
            //value={username}
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
            //value={password}
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
