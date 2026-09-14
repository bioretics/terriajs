// helpers for the app Tour in general
import { TourPoint } from "../../ReactViewModels/defaultTourPoints";
import isDefined from "../../Core/isDefined";

import { RelativePosition } from "../../ReactViewModels/defaultTourPoints";
export {
  RelativePosition,
  TOUR_WIDTH
} from "../../ReactViewModels/defaultTourPoints";

// We need isDefined across these as we are dealing with numbers, 0 is falsy
export function getOffsetsFromTourPoint(tourPoint: TourPoint) {
  // Offsets
  const offsetTop = isDefined(tourPoint?.offsetTop) ? tourPoint.offsetTop : 15;
  const offsetLeft = isDefined(tourPoint?.offsetLeft)
    ? tourPoint.offsetLeft
    : 0;

  // TODO(wing): caret could easily be smarter than manually positioning it,
  // take the rectangle from the highlighted component and set the base offset
  // around that. manually position it for now
  const caretOffsetTop = isDefined(tourPoint?.caretOffsetTop)
    ? tourPoint.caretOffsetTop
    : -3;
  const caretOffsetLeft = isDefined(tourPoint?.caretOffsetLeft)
    ? tourPoint.caretOffsetLeft
    : 20;

  // todo: more stuff that could be structured better
  const indicatorOffsetTop = isDefined(tourPoint?.indicatorOffsetTop)
    ? tourPoint.indicatorOffsetTop
    : -20;
  const indicatorOffsetLeft = isDefined(tourPoint?.indicatorOffsetLeft)
    ? tourPoint.indicatorOffsetLeft
    : 3;
  return {
    offsetTop,
    offsetLeft,
    caretOffsetTop,
    caretOffsetLeft,
    indicatorOffsetTop,
    indicatorOffsetLeft
  };
}

interface HelpScreen {
  rectangle: DOMRect;
  positionLeft: number;
  positionTop: number;
  offsetLeft?: number;
  offsetTop?: number;
}

/**
 * Work out the screen pixel value for left positioning based on helpScreen parameters.
 * @private
 */
export function calculateLeftPosition(helpScreen: HelpScreen) {
  const screenRect = helpScreen.rectangle;
  if (!screenRect) {
    console.log("no rectangle in helpScreen");
    return 0;
  }
  let leftPosition = 0;
  if (helpScreen.positionLeft === RelativePosition.RECT_LEFT) {
    leftPosition = screenRect.left;
  } else if (helpScreen.positionLeft === RelativePosition.RECT_RIGHT) {
    leftPosition = screenRect.right;
  } else if (helpScreen.positionLeft === RelativePosition.RECT_TOP) {
    leftPosition = screenRect.top;
  } else if (helpScreen.positionLeft === RelativePosition.RECT_BOTTOM) {
    leftPosition = screenRect.bottom;
  }

  leftPosition += helpScreen.offsetLeft || 0;
  return leftPosition;
}

/**
 * Work out the screen pixel value for top positioning based on helpScreen parameters.
 * @private
 */
export function calculateTopPosition(helpScreen: HelpScreen) {
  const screenRect = helpScreen.rectangle;
  if (!screenRect) {
    console.log("no rectangle in helpScreen");
    return 0;
  }
  let topPosition = 0;
  if (helpScreen.positionTop === RelativePosition.RECT_LEFT) {
    topPosition = screenRect.left;
  } else if (helpScreen.positionTop === RelativePosition.RECT_RIGHT) {
    topPosition = screenRect.right;
  } else if (helpScreen.positionTop === RelativePosition.RECT_TOP) {
    topPosition = screenRect.top;
  } else if (helpScreen.positionTop === RelativePosition.RECT_BOTTOM) {
    topPosition = screenRect.bottom;
  }

  topPosition += helpScreen.offsetTop || 0;
  return topPosition;
}

export const TOUR_VIEWPORT_MARGIN = 10;

interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function calculateViewportShift(
  box: ScreenBox,
  margin: number = TOUR_VIEWPORT_MARGIN
): { x: number; y: number } {
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 0;

  let x = Math.min(0, viewportWidth - margin - (box.left + box.width));
  if (box.left + x < margin) {
    x = margin - box.left;
  }

  let y = Math.min(0, viewportHeight - margin - (box.top + box.height));
  if (box.top + y < margin) {
    y = margin - box.top;
  }

  return { x, y };
}
