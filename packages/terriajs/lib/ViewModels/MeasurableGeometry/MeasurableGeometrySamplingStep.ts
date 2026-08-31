export const SAMPLING_STEP_SERIES = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000
];

const MAX_SAMPLE_POINTS = 1000;
const MIN_SAMPLE_POINTS = 10;
const MIN_RANGE_WIDTH = 2;

enum SnapMode {
  Up = "up",
  Down = "down",
  Nearest = "nearest"
}

function snapSamplingStep(
  value: number,
  mode: SnapMode = SnapMode.Nearest
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
  if (mode === SnapMode.Down || series[i] === value) {
    return series[i];
  }
  if (mode === SnapMode.Up) {
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
    snapSamplingStep(pathLength / MAX_SAMPLE_POINTS, SnapMode.Up)
  );
  const maxIndex = Math.min(
    series.length - 1,
    Math.max(
      series.indexOf(
        snapSamplingStep(pathLength / MIN_SAMPLE_POINTS, SnapMode.Down)
      ),
      minIndex + MIN_RANGE_WIDTH
    )
  );
  return [series[minIndex], series[Math.max(minIndex, maxIndex)]];
}

const PIXELS_PER_SAMPLE = 10;

function blendSamplingStep(
  pathLength: number | undefined,
  groundResolution: number | undefined,
  viewWeight: number
): number {
  const [min, max] = samplingStepRange(pathLength);
  if (!min || !max) {
    return 0;
  }
  const lengthStep = Math.sqrt(min * max);
  const weight = Math.min(1, Math.max(0, viewWeight));
  if (
    !groundResolution ||
    groundResolution <= 0 ||
    !Number.isFinite(groundResolution) ||
    weight === 0
  ) {
    return snapSamplingStep(lengthStep);
  }
  const viewStep = groundResolution * PIXELS_PER_SAMPLE;
  const blended = lengthStep ** (1 - weight) * viewStep ** weight;
  return snapSamplingStep(Math.min(max, Math.max(min, blended)));
}

export function profileSamplingStep(
  pathLength: number | undefined,
  groundResolution?: number
): number {
  return blendSamplingStep(pathLength, groundResolution, 0.5);
}
export function flightSamplingStep(
  pathLength: number | undefined,
  groundResolution?: number
): number {
  return blendSamplingStep(pathLength, groundResolution, 1);
}

export const SAMPLING_STEP_DISABLED = 0;
