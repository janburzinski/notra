export const SHOW_GEO_CHART_TOOL_NAME = "showGeoChart";
export const SHOW_CHART_TOOL_NAME = "showChart";

/** Tools whose only job is to draw a chart into the answer. */
export const SHOW_CHART_TOOL_NAMES: readonly string[] = [
  SHOW_GEO_CHART_TOOL_NAME,
  SHOW_CHART_TOOL_NAME,
];

export const GEO_CHART_KINDS = ["engines", "trend", "competitors"] as const;
