import { action } from "mobx";
import { observer } from "mobx-react";
import { sortable } from "react-anything-sortable";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import getPath from "../../Core/getPath";
import CatalogMemberMixin, {
  getName
} from "../../ModelMixins/CatalogMemberMixin";
import MappableMixin from "../../ModelMixins/MappableMixin";
import ReferenceMixin from "../../ModelMixins/ReferenceMixin";
import CommonStrata from "../../Models/Definition/CommonStrata";
import { BaseModel } from "../../Models/Definition/Model";
import ViewState from "../../ReactViewModels/ViewState";
import Box, { BoxSpan } from "../../Styled/Box";
import { RawButton } from "../../Styled/Button";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { Li } from "../../Styled/List";
import { TextSpan } from "../../Styled/Text";
import Loader from "../Loader";
import PrivateIndicator from "../PrivateIndicator/PrivateIndicator";
import WorkbenchItemControls from "./Controls/WorkbenchItemControls";

interface IProps {
  item: BaseModel;
  onMouseDown(): void;
  onTouchStart(): void;
  viewState: ViewState;
  className: any;
  style: any;
  setWrapperState(): void;
}

/** Six-dot grip drawn inline (the icon sprite has no equivalent glyph). */
const GripIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);

const WorkbenchItemRaw: React.FC<IProps> = observer((props) => {
  const { item, style, className, viewState, onMouseDown, onTouchStart } =
    props;

  const { t } = useTranslation();

  const toggleDisplay = action(() => {
    if (!CatalogMemberMixin.isMixedInto(item)) return;
    item.setTrait(
      CommonStrata.user,
      "isOpenInWorkbench",
      !item.isOpenInWorkbench
    );
  });

  const toggleVisibility = action(() => {
    if (MappableMixin.isMixedInto(item)) {
      item.setTrait(CommonStrata.user, "show", !item.show);
    }
  });

  /** If workbench item is CatalogMember use CatalogMemberTraits.isOpenInWorkbench
   * Otherwise, defaults to true
   */
  const isOpen =
    !CatalogMemberMixin.isMixedInto(item) || item.isOpenInWorkbench;

  const isLoading =
    (CatalogMemberMixin.isMixedInto(item) && item.isLoading) ||
    (ReferenceMixin.isMixedInto(item) && item.isLoadingReference);

  const isMappable = MappableMixin.isMixedInto(item);
  const isShown = isMappable && item.show;
  const name = getName(item);
  const typeLabel = item.type;

  return (
    <StyledLi style={style} className={className}>
      <ItemRow>
        <DragHandle
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          title={getPath(item, " → ")}
        >
          <GripIcon />
        </DragHandle>
        {isMappable ? (
          <VisibilityButton
            type="button"
            aria-pressed={isShown}
            title={t(($) => $.workbench.toggleVisibility)}
            onClick={toggleVisibility}
          >
            <StyledIcon
              styledWidth="14px"
              glyph={isShown ? Icon.GLYPHS.enable : Icon.GLYPHS.disable}
            />
          </VisibilityButton>
        ) : (
          !isLoading && (
            <BoxSpan centered styledWidth="24px" styledHeight="24px">
              <StyledIcon
                styledWidth="14px"
                light
                glyph={Icon.GLYPHS.lineChart}
              />
            </BoxSpan>
          )
        )}
        <NameBox
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          title={getPath(item, " → ")}
          dimmed={isMappable && !isShown}
        >
          <TextSpan
            displayBlock
            medium
            semiBold
            fullWidth
            overflowHide
            overflowEllipsis
            noWrap
            title={name}
          >
            {name}
          </TextSpan>
        </NameBox>
        {CatalogMemberMixin.isMixedInto(item) && item.isPrivate && (
          <BoxSpan paddedHorizontally>
            <PrivateIndicator inWorkbench />
          </BoxSpan>
        )}
        {typeLabel && <TypeBadge title={typeLabel}>{typeLabel}</TypeBadge>}
        {CatalogMemberMixin.isMixedInto(item) ? (
          <ChevronButton
            type="button"
            onClick={toggleDisplay}
            aria-expanded={isOpen}
            title={
              isOpen ? t(($) => $.general.close) : t(($) => $.general.open)
            }
          >
            <StyledIcon
              styledWidth="10px"
              glyph={isOpen ? Icon.GLYPHS.opened : Icon.GLYPHS.closed}
            />
          </ChevronButton>
        ) : null}
      </ItemRow>
      {isOpen && (
        <ItemBody column gap={2}>
          <WorkbenchItemControls item={item} viewState={viewState} />
          {isLoading ? (
            <Box paddedVertically>
              <Loader light />
            </Box>
          ) : null}
        </ItemBody>
      )}
    </StyledLi>
  );
});

WorkbenchItemRaw.displayName = "WorkbenchItem";

const StyledLi = styled(Li)`
  /* GeoLibre-style layer card */
  background: ${(p) => p.theme.dark};
  color: ${(p) => p.theme.textLight};
  border-radius: ${(p) => p.theme.radiusMedium};
  border: 1px solid ${(p) => p.theme.border};
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease;

  margin-bottom: 4px;
  &:last-child {
    margin-bottom: 0px;
  }

  &:hover {
    border-color: ${(p) => p.theme.inputBorder};
  }
`;

const ItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 36px;
  padding: 4px 6px 4px 4px;
`;

const DragHandle = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  flex-shrink: 0;
  border-radius: ${(p) => p.theme.radiusSmall};
  color: ${(p) => p.theme.mutedForeground};
  cursor: grab;

  svg {
    fill: currentColor;
  }

  &:hover {
    background: ${(p) => p.theme.muted};
  }
  &:active {
    cursor: grabbing;
  }
`;

const NameBox = styled.div<{ dimmed?: boolean }>`
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  cursor: move;
  color: ${(p) => (p.dimmed ? p.theme.mutedForeground : p.theme.textLight)};
`;

const VisibilityButton = styled(RawButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: ${(p) => p.theme.radiusSmall};
  color: ${(p) => p.theme.textLight};

  svg {
    fill: currentColor;
  }

  &[aria-pressed="false"] {
    color: ${(p) => p.theme.mutedForeground};
  }

  &:hover,
  &:focus-visible {
    background: ${(p) => p.theme.muted};
    color: ${(p) => p.theme.textLight};
  }
`;

const ChevronButton = styled(RawButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: ${(p) => p.theme.radiusSmall};
  color: ${(p) => p.theme.mutedForeground};

  svg {
    fill: currentColor;
  }

  &:hover,
  &:focus-visible {
    background: ${(p) => p.theme.muted};
    color: ${(p) => p.theme.textLight};
  }
`;

const TypeBadge = styled.span`
  flex-shrink: 0;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 4px;
  border-radius: ${(p) => p.theme.radiusSmall};
  background: ${(p) => p.theme.muted};
  color: ${(p) => p.theme.mutedForeground};
  font-family: ${(p) => p.theme.fontBase};
  font-size: 10px;
  line-height: 14px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const ItemBody = styled(Box)`
  padding: 8px;
  border-top: 1px solid ${(p) => p.theme.border};
  color: ${(p) => p.theme.greyLighter};
`;

export default sortable(WorkbenchItemRaw);
