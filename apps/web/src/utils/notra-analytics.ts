import { TRACKER_RELEASE } from "@notra/web-tracker/release";
import type { Script } from "c15t";

import {
  NOTRA_ANALYTICS_COLLECT_URL,
  NOTRA_ANALYTICS_SCRIPT_ORIGIN,
} from "@/constants/notra-analytics";

/**
 * notra.js on our own website, loaded like databuddy only after measurement
 * consent. The web key is public by design: it ships in the page and only
 * records page views on the project's tracked domains. The tag pins the build
 * from this commit with its integrity hash, like the tag customers copy.
 */
export function notraAnalyticsScript(webKey: string): Script {
  return {
    id: "notra-analytics",
    src: `${NOTRA_ANALYTICS_SCRIPT_ORIGIN}/${TRACKER_RELEASE.file}`,
    category: "measurement",
    defer: true,
    attributes: {
      "data-key": webKey,
      "data-api": NOTRA_ANALYTICS_COLLECT_URL,
      integrity: TRACKER_RELEASE.integrity,
      crossorigin: "anonymous",
    },
  };
}
