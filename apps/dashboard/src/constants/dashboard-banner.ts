import type { DashboardBannerContent } from "@/types/components/dashboard-banner";

export const DASHBOARD_BANNER_HEIGHT = "2.75rem";
export const DASHBOARD_BANNER_COLORS_LIGHT = {
  colorBack: "#FFFFFF",
  colorFront: "#CBB6EF",
} as const;
export const DASHBOARD_BANNER_COLORS_DARK = {
  colorBack: "#131316",
  colorFront: "#4C1D95",
} as const;
export const DASHBOARD_BANNER_DITHER_SHAPE = "simplex";
export const DASHBOARD_BANNER_DITHER_TYPE = "4x4";
export const DASHBOARD_BANNER_DITHER_SIZE = 2;
export const DASHBOARD_BANNER_DITHER_SPEED = 0.35;
export const DASHBOARD_BANNER_DITHER_SCALE = 0.6;
export const DASHBOARD_BANNER: DashboardBannerContent | null = null;
