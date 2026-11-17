import type { CSSProperties, ReactNode } from "react";

export interface DashboardShellProps {
  children: ReactNode;
  demoBannerHidden: boolean;
  initialSidebarOpen: boolean;
  initialSidebarWidth: number;
}

export interface DashboardShellStyle extends CSSProperties {
  "--top-banner-height": string;
  "--dashboard-banner-height": string;
  "--demo-banner-height"?: string;
}

export interface DashboardSidebarStyle extends CSSProperties {
  "--sidebar-width": string;
}

export interface DashboardDemoChromeProps {
  showBanner: boolean;
}
