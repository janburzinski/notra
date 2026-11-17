import { DASHBOARD_BANNER_HEIGHT } from "@/constants/dashboard-banner";
import { DEMO_BANNER_HEIGHT } from "@/constants/demo";
import type { DashboardShellStyle } from "@/types/components/dashboard-shell";

/**
 * Everything below the top banners offsets by `--top-banner-height`; the demo
 * bar stacks above the dashboard banner when both are shown.
 */
export function dashboardShellStyle(
  demoBanner: boolean,
  dashboardBanner: boolean
): DashboardShellStyle {
  const bannerHeight = dashboardBanner ? DASHBOARD_BANNER_HEIGHT : "0rem";
  if (!demoBanner) {
    return {
      "--top-banner-height": bannerHeight,
      "--dashboard-banner-height": bannerHeight,
    };
  }
  return {
    "--top-banner-height": `calc(${DEMO_BANNER_HEIGHT} + ${bannerHeight})`,
    "--dashboard-banner-height": bannerHeight,
    "--demo-banner-height": DEMO_BANNER_HEIGHT,
  };
}
