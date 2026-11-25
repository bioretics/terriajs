import Color from "terriajs-cesium/Source/Core/Color";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import RepositionableBoxDrawing, {
  isRepositionableSideEntity,
  RepositionableBoxDrawingOptions
} from "./RepositionableBoxDrawing";
import Cesium from "./Cesium";

export const REPOSITIONABLE_BOX_DRAWING_STYLE = {
  sideFillColor: Color.WHITE.withAlpha(0.18),
  sideOutlineColor: Color.WHITE,
  sideHighlightFillColor: Color.WHITE.withAlpha(0.3),
  sideHighlightOutlineColor: Color.CYAN,
  verticalEdgeColor: Color.CYAN.withAlpha(0.85),
  horizontalEdgeColor: Color.YELLOW.withAlpha(0.85),
  freeEdgeColor: Color.ORANGE.withAlpha(0.9),
  edgeHighlightColor: Color.WHITE,
  sideOutlineWidth: 3
};

type RepositionableBoxDrawingFactoryOptions = Pick<
  RepositionableBoxDrawingOptions,
  "keepBoxAboveGround"
>;

export default function createRepositionableBoxDrawing(
  cesium: Cesium,
  editorTransform: Matrix4,
  is2D: boolean,
  options: RepositionableBoxDrawingFactoryOptions = {}
): RepositionableBoxDrawing {
  const boxDrawing = RepositionableBoxDrawing.fromTransform(
    cesium,
    editorTransform,
    {
      ...options,
      disableVerticalMovement: is2D,
      allowedTranslationAxes: is2D ? ["x", "y"] : ["x", "y", "z"],
      allowedRotationAxes: is2D ? ["map-normal"] : ["heading", "pitch", "roll"],
      drawNonUniformScaleGrips: false
    }
  );
  boxDrawing.dataSource.entities.values
    .filter(isRepositionableSideEntity)
    .forEach((side) => {
      side.plane.outlineWidth = new ConstantProperty(
        REPOSITIONABLE_BOX_DRAWING_STYLE.sideOutlineWidth
      );
    });
  boxDrawing.enableScaling = false;
  return boxDrawing;
}
