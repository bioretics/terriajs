import { getMakiIcon } from "../../Map/Icons/Maki/MakiIcons";
import { OptionRenderer } from "../../Models/SelectableDimensions/SelectableDimensions";
import {
  BASEMAP_CONTRAST_BLACK,
  MAKI_ICON_DEFAULT_COLOR
} from "../../Core/DefaultVisualStyles";

export const MarkerOptionRenderer: OptionRenderer = (option) => (
  <div>
    <img
      width="20px"
      height="20px"
      style={{ marginBottom: -5 }}
      src={
        getMakiIcon(
          option.value,
          BASEMAP_CONTRAST_BLACK,
          1,
          MAKI_ICON_DEFAULT_COLOR,
          24,
          24
        ) ?? option.value
      }
    />{" "}
    {option.value}
  </div>
);
