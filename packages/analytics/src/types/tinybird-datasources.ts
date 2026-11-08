import type { InferRow } from "@tinybirdco/sdk";

import type {
  geoImportedDaily,
  webErrors,
  webEvents,
  webImportedDaily,
  webPageEngagement,
  webPageViews,
} from "../tinybird/datasources";

export type WebPageViewRow = InferRow<typeof webPageViews>;

export type WebPageEngagementRow = InferRow<typeof webPageEngagement>;

export type WebEventRow = InferRow<typeof webEvents>;

export type WebErrorRow = InferRow<typeof webErrors>;

export type WebImportedDailyRow = InferRow<typeof webImportedDaily>;

export type GeoImportedDailyRow = InferRow<typeof geoImportedDaily>;
