"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/analytics/posthog-client";
import type { TrafficViewedInput } from "@/types/geo-traffic-pages";

/** Reports the first ready render of an analytics page, once per mount. */
export function useTrafficViewed({
  page,
  ready,
  isSetUp,
  hasData,
  rangePreset,
}: TrafficViewedInput) {
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current || !ready) {
      return;
    }
    viewedRef.current = true;
    trackEvent(POSTHOG_EVENTS.TRAFFIC_VIEWED, {
      page,
      has_traffic: isSetUp && hasData,
      // Kept under its old name so existing PostHog insights keep working.
      has_settings: isSetUp,
      range: rangePreset,
    });
  }, [hasData, isSetUp, page, rangePreset, ready]);
}
