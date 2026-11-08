"use client";

import { useGeoRange } from "@/lib/hooks/use-geo-range";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { useParams, usePathname, useRouter } from "@/lib/navigation";
import type { AnalyticsImportSummary } from "@/types/analytics-imports";
import { viewImportedAnalytics } from "@/utils/analytics-import-progress";

/**
 * Shows a finished import where its data lands: page views in Web
 * analytics, crawler hits in AI analytics. Widens the range to its first day
 * when the current one misses part of it, in place when that page is open
 * and by navigating there from anywhere else.
 */
export function useViewImportedAnalytics() {
  const pathname = usePathname();
  const router = useRouter();
  const { slug = "" } = useParams<{ slug?: string }>();
  const geoRange = useGeoRange();
  const { isOpen: settingsOpen, closeSettings } = useSettingsModal();

  return (item: AnalyticsImportSummary) =>
    viewImportedAnalytics(
      item,
      {
        slug,
        pathname,
        range: geoRange.range,
        rangeParam: geoRange.param,
        today: new Date().toISOString().slice(0, 10),
      },
      {
        push: (href) => router.push(href),
        setRange: geoRange.setCustom,
        ...(settingsOpen ? { closeSettings } : {}),
      }
    );
}
