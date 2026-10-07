import { observer } from "mobx-react";
import React, { FC, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getName } from "../../../../ModelMixins/CatalogMemberMixin";
import { AutoStartData } from "../../../../Models/InitSource";
import Terria from "../../../../Models/Terria";
import ViewState from "../../../../ReactViewModels/ViewState";
import Box from "../../../../Styled/Box";
import Checkbox from "../../../../Styled/Checkbox";
import Spacing from "../../../../Styled/Spacing";
import Text, { TextSpan } from "../../../../Styled/Text";
import { useCallbackRef } from "../../../useCallbackRef";
import { AdvancedOptions } from "./AdvancedOptions";
import { canShorten, getAutoStartSource } from "./BuildShareLink";
import { PrintSection } from "./Print/PrintSection";
import { shouldShorten as shouldShortenDefault } from "./SharePanel";
import { IShareUrlRef, ShareUrl, ShareUrlBookmark } from "./ShareUrl";
import { StyledHr } from "./StyledHr";

interface ISharePanelContentProps {
  terria: Terria;
  viewState: ViewState;
  closePanel: () => void;
}

const SharePanelContentBase: FC<ISharePanelContentProps> = ({
  terria,
  viewState,
  closePanel
}) => {
  const { t } = useTranslation();
  const canShortenUrl = useMemo(() => !!canShorten(terria), [terria]);

  const [includeStoryInShare, setIncludeStoryInShare] = useState(true);
  const [shouldShorten, setShouldShorten] = useState(
    shouldShortenDefault(terria)
  );

  const [autoStartPlay, setAutoStartPlay] = useState(false);
  const [autoStartTour, setAutoStartTour] = useState(false);
  const autoStartSource = getAutoStartSource(terria, viewState);
  const autoStartFeature = autoStartSource?.feature;
  const autoStartItemId = autoStartSource?.item.uniqueId;
  const autoStart = useMemo<AutoStartData | undefined>(() => {
    const play = autoStartFeature === "playPath" && autoStartPlay;
    return autoStartFeature && autoStartItemId && (play || autoStartTour)
      ? {
          itemId: autoStartItemId,
          feature: autoStartFeature,
          play,
          tour: autoStartTour
        }
      : undefined;
  }, [autoStartFeature, autoStartItemId, autoStartPlay, autoStartTour]);

  const [_, update] = useState<object>();
  const shareUrlRef = useCallbackRef<IShareUrlRef>(null, () => update({}));

  const includeStoryInShareOnChange = useCallback(() => {
    setIncludeStoryInShare((prevState) => !prevState);
  }, []);

  const shouldShortenOnChange = useCallback(() => {
    setShouldShorten((prevState) => {
      terria.setLocalProperty("shortenShareUrls", !prevState);
      return !prevState;
    });
  }, [terria]);

  return (
    <Box paddedRatio={2} column>
      <Text medium>{t("clipboard.shareURL")}</Text>
      <Spacing bottom={1} />
      <ShareUrl
        theme="dark"
        inputTheme="dark"
        terria={terria}
        viewState={viewState}
        includeStories={includeStoryInShare}
        autoStart={autoStart}
        shouldShorten={shouldShorten}
        ref={shareUrlRef}
        callback={closePanel}
      >
        <ShareUrlBookmark viewState={viewState} />
      </ShareUrl>
      <Spacing bottom={2} />
      {autoStartSource && (
        <>
          <Text medium>{t("share.autoStartTitle")}</Text>
          <Spacing bottom={1} />
          {autoStartSource.feature === "playPath" && (
            <>
              <Checkbox
                textProps={{ medium: true }}
                isChecked={autoStartPlay}
                onChange={() => setAutoStartPlay((prevState) => !prevState)}
              >
                <TextSpan>
                  {t("share.autoStartPlay", {
                    name: getName(autoStartSource.item)
                  })}
                </TextSpan>
              </Checkbox>
              <Spacing bottom={1} />
            </>
          )}
          <Checkbox
            textProps={{ medium: true }}
            isChecked={autoStartTour}
            onChange={() => setAutoStartTour((prevState) => !prevState)}
          >
            <TextSpan>
              {t("share.autoStartTour", {
                feature: t(
                  autoStartSource.feature === "playPath"
                    ? "workbench.playPath"
                    : "workbench.pathItem"
                )
              })}
            </TextSpan>
          </Checkbox>
          <Spacing bottom={2} />
        </>
      )}
      <PrintSection viewState={viewState} />
      <StyledHr />
      <AdvancedOptions
        viewState={viewState}
        canShortenUrl={canShortenUrl}
        shouldShorten={shouldShorten}
        shouldShortenOnChange={shouldShortenOnChange}
        includeStoryInShare={includeStoryInShare}
        includeStoryInShareOnChange={includeStoryInShareOnChange}
        shareUrl={shareUrlRef}
      />
    </Box>
  );
};

export const SharePanelContent = observer(SharePanelContentBase);
