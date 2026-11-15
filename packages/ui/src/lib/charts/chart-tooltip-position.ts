const TOOLTIP_POINTER_GAP = 12;
const ECHARTS_TOOLTIP_GAP = 20;
const FIXED_TOOLTIP_Y = 8;

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function clampTooltipX(
  x: number,
  tooltipWidth: number,
  viewWidth: number
): number {
  return clamp(x, 0, Math.max(0, viewWidth - tooltipWidth));
}

function sideOffsetTooltipX(
  pointerX: number,
  tooltipWidth: number,
  viewWidth: number
): number {
  const rightX = pointerX + TOOLTIP_POINTER_GAP;
  const leftX = pointerX - tooltipWidth - TOOLTIP_POINTER_GAP;
  const rightFits = rightX + tooltipWidth <= viewWidth;
  const leftFits = leftX >= 0;

  let x = rightX;
  if (rightFits && leftFits) {
    x = viewWidth - pointerX >= pointerX ? rightX : leftX;
  } else if (leftFits && !rightFits) {
    x = leftX;
  }

  return clampTooltipX(x, tooltipWidth, viewWidth);
}

/** Pin near the top and sit beside the pointer X, without covering the hover line. */
export function fixedTooltipPosition(
  pointerX: number,
  tooltipWidth: number,
  viewWidth: number
): [number, number] {
  return [
    sideOffsetTooltipX(pointerX, tooltipWidth, viewWidth),
    FIXED_TOOLTIP_Y,
  ];
}

/**
 * Follow the pointer, but never slide past the chart's left/right edge.
 * Y may go negative so short sparklines can paint the box above the plot.
 */
export function overflowTooltipPosition(
  pointer: readonly [number, number],
  contentSize: readonly [number, number],
  viewSize: readonly [number, number]
): [number, number] {
  const [pointerX, pointerY] = pointer;
  const [tooltipWidth, tooltipHeight] = contentSize;

  return [
    sideOffsetTooltipX(pointerX, tooltipWidth, viewSize[0]),
    pointerY - tooltipHeight - TOOLTIP_POINTER_GAP,
  ];
}

/**
 * ECharts' default placement for a confined tooltip (`refixTooltipPosition`
 * then `confineTooltipPosition`): 20px right of and below the pointer, on the
 * other side when it would overflow, clamped into the chart.
 */
export function confinedTooltipPosition(
  pointer: readonly [number, number],
  contentSize: readonly [number, number],
  viewSize: readonly [number, number]
): [number, number] {
  const [pointerX, pointerY] = pointer;
  const [tooltipWidth, tooltipHeight] = contentSize;
  const [viewWidth, viewHeight] = viewSize;
  const x =
    pointerX + tooltipWidth + ECHARTS_TOOLTIP_GAP + 2 > viewWidth
      ? pointerX - tooltipWidth - ECHARTS_TOOLTIP_GAP
      : pointerX + ECHARTS_TOOLTIP_GAP;
  const y =
    pointerY + tooltipHeight + ECHARTS_TOOLTIP_GAP > viewHeight
      ? pointerY - tooltipHeight - ECHARTS_TOOLTIP_GAP
      : pointerY + ECHARTS_TOOLTIP_GAP;
  return [
    Math.max(Math.min(x + tooltipWidth, viewWidth) - tooltipWidth, 0),
    Math.max(Math.min(y + tooltipHeight, viewHeight) - tooltipHeight, 0),
  ];
}
