import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  PropsWithChildren
} from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";

import Terria from "../../../../../Models/Terria";
import ViewState from "../../../../../ReactViewModels/ViewState";

import Spacing from "../../../../../Styled/Spacing";
import Text, { TextSpan } from "../../../../../Styled/Text";

import { buildShareLink, buildShortShareLink } from "../BuildShareLink";
import { ShareUrlWarning } from "./ShareUrlWarning";
import Clipboard from "../../../../Clipboard";
import Input from "../../../../../Styled/Input";
import Button from "../../../../../Styled/Button";
import Box from "../../../../../Styled/Box";
import {
  Category,
  ShareAction
} from "../../../../../Core/AnalyticEvents/analyticEvents";
import Styles from "./file-input.scss";

interface IShareUrlProps {
  terria: Terria;
  viewState: ViewState;
  includeStories: boolean;
  shouldShorten: boolean;
  theme: "light" | "dark";
  inputTheme?: "light" | "dark";
  rounded?: boolean;
  callback?: () => void;
}

export interface IShareUrlRef {
  url: string;
  shorteningInProgress: boolean;
}

export const ShareUrl = forwardRef<
  IShareUrlRef,
  PropsWithChildren<IShareUrlProps>
>(
  (
    {
      terria,
      viewState,
      includeStories,
      shouldShorten,
      children,
      theme,
      inputTheme,
      rounded,
      callback
    },
    forwardRef
  ) => {
    const { t } = useTranslation();

    const [shareUrl, setShareUrl] = useState("");
    const [shorteningInProgress, setShorteningInProgress] = useState(false);
    const [placeholder, setPlaceholder] = useState<string>();

    const save = () => {
      const a = document.createElement("a");
      a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(shareUrl);
      a.download = "mappa.geo3d";
      a.click();
    };

    const load = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e?.target?.files && e.target.files.length === 1) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function (f: any) {
          window.open(f.target.result, "_self");
        };
        reader.readAsText(file);
      }
    };

    useImperativeHandle(
      forwardRef,
      () => ({
        url: shareUrl,
        shorteningInProgress: shorteningInProgress
      }),
      [forwardRef, shareUrl, shorteningInProgress]
    );

    useEffect(() => {
      if (shouldShorten) {
        setPlaceholder(t("share.shortLinkShortening"));
        setShorteningInProgress(true);
        buildShortShareLink(terria, viewState, {
          includeStories
        })
          .then((shareUrl) => setShareUrl(shareUrl))
          .catch(() => {
            setShareUrl(
              buildShareLink(terria, viewState, {
                includeStories
              })
            );
          })
          .finally(() => setShorteningInProgress(false));
      } else {
        setShareUrl(
          buildShareLink(terria, viewState, {
            includeStories
          })
        );
      }
    }, [terria, viewState, shouldShorten, includeStories]);

    return (
      <>
        <Explanation textDark={theme === "light"}>
          {t("clipboard.shareExplanation")}
        </Explanation>
        <Spacing bottom={1} />
        <Clipboard
          theme={theme}
          text={shareUrl}
          source={
            <Input
              light={inputTheme === "light"}
              dark={inputTheme === "dark"}
              large
              type="text"
              value={shareUrl}
              placeholder={placeholder ?? t("share.shortLinkShortening")}
              readOnly
              onClick={(e) => e.currentTarget.select()}
              css={`
                ${rounded ? `border-radius:  32px 0 0 32px;` : ""}
              `}
              id="share-url"
            />
          }
          id="share-url"
          rounded={rounded}
          onCopy={(text) =>
            terria.analytics?.logEvent(
              Category.share,
              ShareAction.storyCopy,
              text
            )
          }
        />
        {children}
        <Spacing bottom={2} />
        <ShareUrlWarning
          terria={terria}
          viewState={viewState}
          callback={callback || (() => {})}
        />
        <Spacing bottom={2} />
        <div >
          <Text medium>Salva Mappa</Text>
          <Explanation textDark={theme === "light"}>
            Salva o carica una mappa da file
          </Explanation>
          <Box gap>
            <PrintButton
              primary
              onClick={save}>Salva
            </PrintButton>
            <form>
              <input
                type="file"
                accept=".geo3d"
                className={Styles.input}
                onChange={load}
              />
              < label className={Styles.btn} style={{ borderRadius: 4 }}>
                Carica
              </label>
            </form>
          </Box>
        </div>
      </>
    );
  }
);

const Explanation = styled(TextSpan)`
  opacity: 0.8;
`;

const PrintButton = styled(Button)`
  border-radius: 4px;
`;
