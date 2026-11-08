import type { Script } from "c15t";

import {
  NOTRA_ANALYTICS_COLLECT_URL,
  NOTRA_ANALYTICS_SCRIPT_URL,
} from "@/constants/notra-analytics";

/**
 * notra.js on our own website, loaded like databuddy only after measurement
 * consent. The web key is public by design: it ships in the page and only
 * records page views on the project's tracked domains.
 */
export function notraAnalyticsScript(webKey: string): Script {
  return {
    id: "notra-analytics",
    src: NOTRA_ANALYTICS_SCRIPT_URL,
    category: "measurement",
    defer: true,
    attributes: {
      "data-key": webKey,
      "data-api": NOTRA_ANALYTICS_COLLECT_URL,
    },
  };
}
