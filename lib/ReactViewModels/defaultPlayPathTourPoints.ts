import { TOUR_WIDTH, RelativePosition } from "../ReactViews/Tour/tour-helpers";
import { TourPoint } from "./defaultTourPoints";

export const defaultPlayPathTourPoints: TourPoint[] = [
  {
    appRefName: "PlayPathPanel",
    priority: 100,
    offsetTop: 50,
    offsetLeft: 20,
    content: "translate#playPath.tour.dragPanel"
  },
  {
    appRefName: "PlayPathPlayButton",
    priority: 110,
    caretOffsetTop: -10,
    caretOffsetLeft: 30,
    offsetTop: -80,
    offsetLeft: -50,
    positionTop: RelativePosition.RECT_TOP,
    content: "translate#playPath.tour.playButton"
  },
  {
    appRefName: "PlayPathStopButton",
    priority: 120,
    caretOffsetTop: -10,
    caretOffsetLeft: 80,
    offsetTop: -80,
    offsetLeft: -100,
    positionTop: RelativePosition.RECT_TOP,
    content: "translate#playPath.tour.stopButton"
  },
  {
    appRefName: "PlayPathSpeedSlider",
    priority: 130,
    caretOffsetTop: 20,
    caretOffsetLeft: TOUR_WIDTH / 2,
    offsetTop: 20,
    offsetLeft: -TOUR_WIDTH / 2 + 50,
    positionTop: RelativePosition.RECT_BOTTOM,
    content: "translate#playPath.tour.speedSlider"
  }
];
