import { observer } from "mobx-react";
import { FC } from "react";
import Cesium3dTilesMixin from "../../../ModelMixins/Cesium3dTilesMixin";
import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset";
import Cesium from "../../../Models/Cesium";
import { BaseModel } from "../../../Models/Definition/Model";
import ViewerMode from "../../../Models/ViewerMode";
import ViewState from "../../../ReactViewModels/ViewState";
import { StyledButton } from "../../../Styled/Button";

interface Props {
  item: BaseModel;
  viewState: ViewState;
}

const Reposition3DTilesControl: FC<Props> = observer(({ item, viewState }) => {
  if (
    !Cesium3dTilesMixin.isMixedInto(item) ||
    viewState.terria.mainViewer.viewerMode !== ViewerMode.Cesium ||
    !(viewState.terria.currentViewer instanceof Cesium)
  ) {
    return null;
  }

  const cesium = viewState.terria.currentViewer;
  if (item.isLoadingMapItems) return null;

  const canReposition = item.mapItems.some(
    (mapItem) => mapItem instanceof Cesium3DTileset
  );
  if (!canReposition) return null;

  return (
    <StyledButton
      fullWidth
      onClick={() =>
        viewState.openTool({
          toolName: "Reposition 3D Tiles",
          getToolComponent: () =>
            import("../../Tools/Reposition3DTiles/Reposition3DTilesTool").then(
              (module) => module.default
            ),
          params: { item, cesium, viewState }
        })
      }
    >
      Reposition
    </StyledButton>
  );
});

export default Reposition3DTilesControl;
