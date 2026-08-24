export const SAMPLING_STEP_SERIES = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000
];

const MAX_SAMPLE_POINTS = 1000;
const MIN_SAMPLE_POINTS = 10;
const MIN_RANGE_WIDTH = 2;

type SnapMode = "up" | "down" | "nearest";

export function snapSamplingStep(
  value: number,
  mode: SnapMode = "nearest"
): number {
  const series = SAMPLING_STEP_SERIES;
  const last = series.length - 1;
  if (!(value > series[0])) {
    return series[0];
  }
  if (value >= series[last]) {
    return series[last];
  }
  let i = 0;
  while (i < last && series[i + 1] <= value) {
    ++i;
  }
  if (mode === "down" || series[i] === value) {
    return series[i];
  }
  if (mode === "up") {
    return series[i + 1];
  }
  return value / series[i] <= series[i + 1] / value ? series[i] : series[i + 1];
}

export function samplingStepRange(pathLength: number | undefined): number[] {
  if (!pathLength || pathLength <= 0) {
    return [0, 0];
  }
  const series = SAMPLING_STEP_SERIES;
  const minIndex = series.indexOf(
    snapSamplingStep(pathLength / MAX_SAMPLE_POINTS, "up")
  );
  const maxIndex = Math.min(
    series.length - 1,
    Math.max(
      series.indexOf(snapSamplingStep(pathLength / MIN_SAMPLE_POINTS, "down")),
      minIndex + MIN_RANGE_WIDTH
    )
  );
  return [series[minIndex], series[Math.max(minIndex, maxIndex)]];
}

export function defaultSamplingStep(pathLength: number | undefined): number {
  const [min, max] = samplingStepRange(pathLength);
  if (!min || !max) {
    return 0;
  }
  return snapSamplingStep(Math.sqrt(min * max));
}
