import { observer } from "mobx-react";
import { FC } from "react";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import Box from "../../Styled/Box";
import WorkbenchList from "./WorkbenchList";

interface IProps {
  terria: Terria;
  viewState: ViewState;
}

/**
 * The list of datasets currently on the map. The workbench-wide actions
 * (show/hide all, collapse all, remove all) live in the SidePanel header.
 */
const Workbench: FC<IProps> = observer(({ terria, viewState }) => {
  return (
    <Box column fullWidth styledMinHeight={"0"} flex={1}>
      <WorkbenchList viewState={viewState} terria={terria} />
    </Box>
  );
});

export default Workbench;
