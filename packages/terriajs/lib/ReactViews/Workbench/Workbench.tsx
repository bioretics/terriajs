import { action, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";
import { Component } from "react";
import { TFunction } from "i18next";
import { withTranslation, WithTranslation } from "react-i18next";
import getPath from "../../Core/getPath";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import Box from "../../Styled/Box";
import { RawButton } from "../../Styled/Button";
import { TextSpan } from "../../Styled/Text";
import BadgeBar from "../BadgeBar";
import Icon, { IconGlyph, StyledIcon } from "../../Styled/Icon";
import WorkbenchList from "./WorkbenchList";
import {
  Category,
  DataSourceAction
} from "../../Core/Analytics/analyticEvents";
import MappableMixin from "../../ModelMixins/MappableMixin";

const HeaderButton = (props: {
  glyph: IconGlyph;
  label: string;
  onClick: () => void;
}) => (
  <RawButton
    onClick={props.onClick}
    title={props.label}
    css={`
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 5px;
    `}
  >
    <StyledIcon glyph={props.glyph} light styledWidth={"18px"} displayInline />
    <TextSpan textLight small isLink>
      {props.label}
    </TextSpan>
  </RawButton>
);

interface IProps extends WithTranslation {
  terria: Terria;
  viewState: ViewState;
  t: TFunction;
}

@observer
class Workbench extends Component<IProps> {
  constructor(props: IProps) {
    super(props);
    makeObservable(this);
  }

  disableAll() {
    this.props.terria.workbench.disableAll();
  }

  enableAll() {
    this.props.terria.workbench.enableAll();
  }

  @action.bound
  collapseAll() {
    runInAction(() => {
      this.props.terria.workbench.collapseAll();
    });
  }

  @action.bound
  expandAll() {
    runInAction(() => {
      this.props.terria.workbench.expandAll();
    });
  }

  @action.bound
  removeAll() {
    this.props.terria.workbench.items.forEach((item) => {
      this.props.terria.analytics.logEvent(
        Category.dataSource,
        DataSourceAction.removeAllFromWorkbench,
        getPath(item)
      );
      this.props.terria.removeSelectedFeaturesForModel(item);
    });
    this.props.terria.workbench.removeAll();
    (this.props.terria.timelineStack.items as any).clear();
  }

  render() {
    const { t } = this.props;
    const shouldExpandAll = this.props.terria.workbench.shouldExpandAll;

    // show enable all button if all items are disabled
    const showEnableAll = this.props.terria.workbench.items
      .filter((it): it is MappableMixin.Instance =>
        MappableMixin.isMixedInto(it)
      )
      .every((it) => !it.show);

    return (
      <Box column fullWidth styledMinHeight={"0"} flex={1}>
        <BadgeBar
          label={t(($) => $.workbench.label)}
          badge={this.props.terria.workbench.items.length}
        >
          {showEnableAll ? (
            <HeaderButton
              glyph={Icon.GLYPHS.enable}
              label={t(($) => $.workbench.enableAll)}
              onClick={() => this.enableAll()}
            />
          ) : (
            <HeaderButton
              glyph={Icon.GLYPHS.disable}
              label={t(($) => $.workbench.disableAll)}
              onClick={() => this.disableAll()}
            />
          )}
          {shouldExpandAll ? (
            <HeaderButton
              glyph={Icon.GLYPHS.expandAll}
              label={t(($) => $.workbench.expandAll)}
              onClick={this.expandAll}
            />
          ) : (
            <HeaderButton
              glyph={Icon.GLYPHS.collapse}
              label={t(($) => $.workbench.collapseAll)}
              onClick={this.collapseAll}
            />
          )}
          <HeaderButton
            glyph={Icon.GLYPHS.cancel}
            label={t(($) => $.workbench.removeAll)}
            onClick={this.removeAll}
          />
        </BadgeBar>
        <WorkbenchList
          viewState={this.props.viewState}
          terria={this.props.terria}
        />
      </Box>
    );
  }
}

export default withTranslation()(Workbench);
