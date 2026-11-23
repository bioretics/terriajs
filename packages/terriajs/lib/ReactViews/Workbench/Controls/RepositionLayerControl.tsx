import { observer } from "mobx-react";
import { FC } from "react";
import RepositionableMixin from "../../../ModelMixins/RepositionableMixin";
import Cesium from "../../../Models/Cesium";
import { BaseModel } from "../../../Models/Definition/Model";
import ViewerMode from "../../../Models/ViewerMode";
import ViewState from "../../../ReactViewModels/ViewState";
import { StyledButton } from "../../../Styled/Button";

interface Props {
  item: BaseModel;
  viewState: ViewState;
}

const RepositionLayerControl: FC<Props> = observer(({ item, viewState }) => {
  if (
    !RepositionableMixin.isMixedInto(item) ||
    item.isRepositionable !== true ||
    viewState.terria.mainViewer.viewerMode !== ViewerMode.Cesium ||
    !(viewState.terria.currentViewer instanceof Cesium)
  ) {
    return null;
  }

  const cesium = viewState.terria.currentViewer;
  if (item.isLoadingMapItems) return null;

  if (item.mapItems.length === 0) return null;

  return (
    <StyledButton
      fullWidth
      onClick={() =>
        viewState.openTool({
          toolName: "Reposition layer",
          getToolComponent: () =>
            import("../../Tools/RepositionLayer/RepositionLayerTool").then(
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

export default RepositionLayerControl;
