import classNames from "classnames";
import { action, runInAction } from "mobx";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
//import { useTheme } from "styled-components";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import Box from "../../Styled/Box";
import Button from "../../Styled/Button";
import Input from "../../Styled/Input";
import Text from "../../Styled/Text";
import Icon from "../../Styled/Icon";
import Styles from "./login-panel.scss";
import DragWrapper from "../../ReactViews/Drag/DragWrapper";

interface Props {
  terria: Terria;
  viewState: ViewState;
  onClose?: () => void;
}

const LoginPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [messageKey, setMessageKey] = useState<string>();
  const [messageType, setMessageType] = useState<"error" | "info">("error");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  //const theme = useTheme();

  const { t } = useTranslation();

  useEffect(() => {
    setUsername("");
    setPassword("");
    setMessageKey(undefined);
    setMessageType("error");
    setIsLoading(false);
    document.body.style.cursor = "default";
  }, [viewState.isLoginPanelVisible]);

  const panelClassName = classNames(Styles.panel, {
    [Styles.isVisible]: viewState.isLoginPanelVisible,
    [Styles.isLoading]: isLoading
  });

  const doLogin = action(async () => {
    if (terria.userAuthToken) {
      terria.userAuthToken = undefined;
      return;
    }

    const trimmedUsername = username?.trim() ?? "";
    if (!trimmedUsername || !password?.trim()) {
      setMessageType("error");
      setMessageKey("login.loginPanelMissingFields");
      return;
    }

    const loginUrl = terria.configParameters.userProfileLoginServiceUrl;
    if (!loginUrl) {
      return;
    }

    setIsLoading(true);
    setMessageKey(undefined);
    document.body.style.cursor = "wait";

    const authHeader = `Basic ${Buffer.from(
      `${trimmedUsername}:${password}`
    ).toString("base64")}`;
    const formBody = new URLSearchParams({
      username: trimmedUsername,
      password
    }).toString();
    try {
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formBody,
        redirect: "follow",
        credentials: "include"
      });

      // Both valid and invalid form logins return a redirect. GeoServer sends
      // valid credentials to /web and sends invalid credentials to its login
      // page with ?error=true. Following that redirect lets this one login
      // request distinguish the two outcomes without a second API check.
      const responseUrl = new URL(response.url);
      const isInvalidLogin =
        responseUrl.searchParams.get("error") === "true" ||
        responseUrl.pathname.includes("GeoServerLoginPage");

      if (!response.ok || isInvalidLogin) {
        setMessageType("error");
        setMessageKey(
          isInvalidLogin || response.status === 401 || response.status === 403
            ? "login.loginPanelInvalidCredentials"
            : "login.loginPanelGenericError"
        );
        return;
      }

      runInAction(() => {
        terria.userAuthToken = authHeader;
        viewState.isLoginPanelVisible = false;
      });
    } catch (e: any) {
      console.log(e);
      setMessageType("error");
      setMessageKey("login.loginPanelConnectionProblem");
    } finally {
      setIsLoading(false);
      document.body.style.cursor = "default";
    }
  });

  const cancel = () => {
    runInAction(() => {
      viewState.isLoginPanelVisible = false;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      doLogin();
    }
  };

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.isLoginPanelVisible}
      >
        <div className={Styles.header}>
          <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
            <span className={Styles.headerContent}>
              <Icon glyph={Icon.GLYPHS.lock} className={Styles.headerIcon} />
              <b>{t(($) => $.login.loginPanelHeader)}</b>
            </span>
          </div>
        </div>
        <div className={Styles.body}>
          <div className={Styles.fieldGroup}>
            <Text
              textLight
              style={{
                textAlign: "left",
                marginBottom: "4px",
                fontSize: "0.85em"
              }}
              title={t(($) => $.login.loginPanelUsernameTitle)}
            >
              {t(($) => $.login.loginPanelUsername)}
            </Text>
            <Input
              title={t(($) => $.login.loginPanelUsernameTitle)}
              required
              dark
              disabled={isLoading}
              value={username}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                setUsername(e.target.value);
                setMessageKey(undefined);
              }}
            />
          </div>
          <div className={Styles.fieldGroup}>
            <Text
              textLight
              style={{
                textAlign: "left",
                marginBottom: "4px",
                fontSize: "0.85em"
              }}
              title={t(($) => $.login.loginPanelPasswordTitle)}
            >
              {t(($) => $.login.loginPanelPassword)}
            </Text>
            <Input
              title={t(($) => $.login.loginPanelPasswordTitle)}
              required
              dark
              type="password"
              disabled={isLoading}
              value={password}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                setPassword(e.target.value);
                setMessageKey(undefined);
              }}
            />
          </div>
          {messageKey && (
            <div
              className={classNames(Styles.messageBox, {
                [Styles.messageError]: messageType === "error",
                [Styles.messageInfo]: messageType === "info"
              })}
            >
              <Text style={{ textAlign: "center", fontSize: "0.8em" }}>
                {t(messageKey as any)}
              </Text>
            </div>
          )}
          {isLoading && (
            <div className={Styles.loadingIndicator}>
              <Text
                textLight
                style={{ textAlign: "center", fontSize: "0.8em" }}
              >
                {t(($) => $.login.loginPanelLoading)}
              </Text>
            </div>
          )}
          <Box justifySpaceBetween className={Styles.buttonRow}>
            <Button
              primary
              shortMinHeight
              onClick={doLogin}
              disabled={isLoading}
              style={{
                fontSize: "0.85em",
                padding: "6px 20px",
                flex: 1,
                margin: "0 4px 0 0"
              }}
            >
              {t(($) => $.login.loginPanelOk)}
            </Button>
            <Button
              secondary
              shortMinHeight
              onClick={cancel}
              disabled={isLoading}
              style={{
                fontSize: "0.85em",
                padding: "6px 20px",
                flex: 1,
                margin: "0 0 0 4px"
              }}
            >
              {t(($) => $.login.loginPanelCancel)}
            </Button>
          </Box>
        </div>
      </div>
    </DragWrapper>
  );
});

export default LoginPanel;
