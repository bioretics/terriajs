import {
  PropsWithChildren,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState
} from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";

import Terria from "../../../../../Models/Terria";
import ViewState from "../../../../../ReactViewModels/ViewState";

import Spacing from "../../../../../Styled/Spacing";
import { TextSpan } from "../../../../../Styled/Text";

import {
  Category,
  ShareAction
} from "../../../../../Core/Analytics/analyticEvents";
import Clipboard from "../../../../Clipboard";
import { buildShareLink, buildShortShareLink } from "../BuildShareLink";
import { ShareUrlWarning } from "./ShareUrlWarning";
import TerriaError, {
  TerriaErrorSeverity
} from "../../../../../Core/TerriaError";
// Fork (rer3d): import/export map buttons.
import Box from "../../../../../Styled/Box";
import Button from "../../../../../Styled/Button";

interface IShareUrlProps {
  terria: Terria;
  viewState: ViewState;
  includeStories: boolean;
  shouldShorten: boolean;
  callback?: () => void;
}

export interface IShareUrlRef {
  url: string;
  shorteningInProgress: boolean;
}

export const ShareUrl = forwardRef<
  IShareUrlRef,
  PropsWithChildren<IShareUrlProps>
>(function ShareUrl(
  { terria, viewState, includeStories, shouldShorten, children, callback },
  forwardRef
) {
  const { t } = useTranslation();

  const [shareUrl, setShareUrl] = useState("");
  const [shorteningInProgress, setShorteningInProgress] = useState(false);
  const [placeholder, setPlaceholder] = useState<string>();
  const [failed, setFailed] = useState(false);

  useImperativeHandle(
    forwardRef,
    () => ({
      url: shareUrl,
      shorteningInProgress: shorteningInProgress
    }),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [forwardRef, shareUrl, shorteningInProgress]
  );

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (shouldShorten) {
      setPlaceholder(t(($) => $.share.shortLinkShortening));
      setShorteningInProgress(true);
      buildShortShareLink(terria, viewState, { includeStories })
        .then((shareUrl) => {
          if (!cancelled) setShareUrl(shareUrl);
        })
        .catch((error) => {
          // `getShareToken` has already chosen the message for this failure
          // (status code / too large / generic) from the HTTP status.
          const userMessage =
            error instanceof TerriaError
              ? error.highestImportanceError.message
              : t(($) => $.models.shareData.generateErrorMessage);
          if (!cancelled) {
            // Also raise the error as a modal so a failed share is hard to
            // miss. Skip it when cancelled, so a stale request (e.g. after the
            // share options changed) doesn't pop a modal for a share the user
            // has moved past.
            if (error instanceof TerriaError) {
              terria.raiseErrorToUser(error, {
                severity: TerriaErrorSeverity.Error
              });
            }
            setShareUrl(userMessage);
            setFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setShorteningInProgress(false);
        });
    } else {
      setShareUrl(
        buildShareLink(terria, viewState, {
          includeStories
        })
      );
    }
    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [terria, viewState, shouldShorten, includeStories]);

  // Fork (rer3d): export the current share state to a .geo3d file / import one.
  const exportMap = () => {
    const link = document.createElement("a");
    link.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(shareUrl)
    );
    link.setAttribute("download", `mappa.geo3d`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importMap = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const files = input.files;
      if (files && files?.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function (f: any) {
          window.open(f.target.result, "_self");
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const hasStory = includeStories && terria.stories && terria.stories.length;

  return (
    <>
      <Explanation>
        {hasStory
          ? t(($) => $.clipboard.storyExplanation)
          : t(($) => $.clipboard.shareExplanation)}
      </Explanation>
      <Spacing bottom={1} />
      <Clipboard
        text={shareUrl}
        failed={failed}
        inputPlaceholder={placeholder}
        createdMessage={
          hasStory
            ? t(($) => $.share.storyLinkCreated)
            : t(($) => $.share.shareLinkCreated)
        }
        onCopy={(text) =>
          terria.analytics.logEvent(Category.share, ShareAction.storyCopy, text)
        }
      />
      {children}
      <ShareUrlWarning
        terria={terria}
        viewState={viewState}
        callback={callback || (() => {})}
      />
      <Spacing bottom={2} />
      <Box column>
        <TextSpan medium>{t(($) => $.share.importExportMapTitle)}</TextSpan>
        <Explanation>
          {t(($) => $.share.importExportMapExplanation)}
        </Explanation>
        <Box gap>
          <PrintButton primary fullWidth onClick={exportMap}>
            {t(($) => $.share.exportMapButton)}
          </PrintButton>
          <PrintButton primary fullWidth onClick={importMap}>
            {t(($) => $.share.importMapButton)}
          </PrintButton>
        </Box>
      </Box>
    </>
  );
});

const Explanation = styled(TextSpan)`
  opacity: 0.8;
`;

const PrintButton = styled(Button)`
  border-radius: 4px;
`;
