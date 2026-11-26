import { action } from "mobx";
import { observer } from "mobx-react";
import Slider from "rc-slider";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import Cesium from "../../../Models/Cesium";
import Terria from "../../../Models/Terria";
import ViewerMode from "../../../Models/ViewerMode";
import Box from "../../../Styled/Box";
import Spacing from "../../../Styled/Spacing";
import Text from "../../../Styled/Text";
import { useViewState } from "../../Context";

function isCesiumWithTerrain(terria: Terria): boolean {
  return (
    terria.mainViewer.viewerMode === ViewerMode.Cesium &&
    terria.mainViewer.viewerOptions.useTerrain &&
    !!terria.currentViewer &&
    terria.currentViewer instanceof Cesium &&
    !!terria.currentViewer.scene?.globe
  );
}

/**
 * Slider for uniform 3D terrain/globe opacity in the map settings panel.
 * Hidden when terrain-by-distance translucency is active or via config.
 */
const TerrainOpacitySlider: FC = observer(() => {
  const { t } = useTranslation();
  const viewState = useViewState();
  const { terria } = viewState;

  const distanceTranslucencyActive =
    !!terria.configParameters.globeTranslucency &&
    terria.globeTranslucencyEnabled;

  if (
    terria.configParameters.disableTerrainOpacityControl ||
    !isCesiumWithTerrain(terria)
  ) {
    return null;
  }

  if (distanceTranslucencyActive) {
    return (
      <>
        <Spacing bottom={2} />
        <Box column>
          <Text
            mini
            textLightDimmed
            title={t(($) => $.settingPanel.terrain.terrainOpacityTitle)}
          >
            {t(($) => $.settingPanel.terrain.globeTranslucencyEnabledTitle)}
          </Text>
        </Box>
      </>
    );
  }

  const changeOpacity = action((value: number) => {
    terria.setTerrainOpacity(value / 100);
    terria.setLocalProperty("terrainOpacity", terria.terrainOpacity.toString());
    terria.currentViewer.notifyRepaintRequired();
  });

  const label = t(($) => $.settingPanel.terrain.terrainOpacity);
  const title = t(($) => $.settingPanel.terrain.terrainOpacityTitle);

  return (
    <>
      <Spacing bottom={2} />
      <Box column>
        <Box paddedVertically={1}>
          <Text as="label" title={title}>
            {label}
          </Text>
        </Box>
        <Box verticalCenter>
          <Slider
            min={0}
            max={100}
            value={(terria.terrainOpacity * 100) | 0}
            onChange={changeOpacity}
            aria-valuetext={`${(terria.terrainOpacity * 100) | 0}%`}
            css={`
              margin: 0 10px;
              margin-top: 5px;
            `}
          />
        </Box>
      </Box>
    </>
  );
});

export default TerrainOpacitySlider;
