import type { JourneysChartMetric } from "@/types/geo";

export const TRAFFIC_HERO_FRAME_CLASS =
  "@container/hero min-w-0 rounded-2xl border border-shell-border bg-shell px-0.5 pb-0.5";

export const TRAFFIC_HERO_METRICS_GRID_CLASS =
  "grid grid-cols-1 @xs/hero:grid-cols-2 @3xl/hero:grid-cols-4";

export const TRAFFIC_HERO_METRICS_SURFACE_CLASS = "pb-5";

export const TRAFFIC_HERO_METRICS_STANDALONE_CLASS = "";

export const TRAFFIC_HERO_CHART_SURFACE_CLASS =
  "border-table-card-border bg-table-card shadow-table-card relative -mt-5 rounded-[14px] border p-4";

export const TRAFFIC_HERO_METRIC_CELL_CLASS =
  "border-border flex min-w-0 flex-col gap-2 overflow-hidden border-b px-4 py-4 last:border-b-0 @xs/hero:odd:border-r @xs/hero:nth-[n+3]:border-b-0 @sm/hero:px-5 @3xl/hero:border-r @3xl/hero:border-b-0 @3xl/hero:px-6 @3xl/hero:last:border-r-0";

/** Public embeds drop the unconfigured conversions stage: one row of three. */
export const TRAFFIC_HERO_METRICS_THREE_UP_GRID_CLASS =
  "grid grid-cols-1 @sm/hero:grid-cols-3";

export const TRAFFIC_HERO_METRIC_CELL_THREE_UP_CLASS =
  "border-border flex min-w-0 flex-col gap-2 overflow-hidden border-b px-4 py-4 last:border-b-0 @sm/hero:border-r @sm/hero:border-b-0 @sm/hero:px-5 @sm/hero:last:border-r-0 @3xl/hero:px-6";

export const TRAFFIC_HERO_METRIC_VALUE_CLASS =
  "min-w-0 text-2xl leading-none font-semibold tracking-tight tabular-nums @4xl/hero:text-3xl";

export const TRAFFIC_HERO_CHART_OPTIONS = {
  grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
};

export const TRAFFIC_HERO_TREND_STROKE_WIDTH = 1.5;

/** The hero tiles sit flat on the shell, two pixels apart like its rim. */
export const TRAFFIC_HERO_TILES_CLASS = "gap-0.5 pt-0.5";

/** The selected tile is raised as a card like the chart below it. */
export const TRAFFIC_HERO_TILE_CLASS =
  "group/metric relative flex min-w-0 flex-col gap-2 rounded-[14px] border border-transparent p-4 transition-colors data-[selected]:border-table-card-border data-[selected]:bg-table-card data-[selected]:shadow-table-card";

/**
 * The tile's label is its button and stretches over the whole tile, so the
 * change badge (its own tooltip button) isn't nested inside it.
 */
export const TRAFFIC_HERO_TILE_BUTTON_CLASS =
  "cursor-pointer self-start text-left text-sm leading-5 font-semibold tracking-tight outline-none transition-colors after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset";

/** Unselected tiles read quieter and light up on hover. */
export const TRAFFIC_HERO_TILE_MUTED_CLASS =
  "text-muted-foreground transition-colors group-hover/metric:text-foreground";

/** Series key of the Journeys hero chart for every metric but journeys. */
export const JOURNEYS_METRIC_SERIES_KEY = "value";

/** The Journeys hero opens on journeys, split into crawlers and referrals. */
export const JOURNEYS_DEFAULT_CHART_METRIC: JourneysChartMetric = "journeys";
