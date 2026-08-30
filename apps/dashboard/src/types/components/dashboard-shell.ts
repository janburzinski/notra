import type { CSSProperties, ReactNode } from "react";

export interface DashboardShellProps {
  children: ReactNode;
  initialSidebarOpen: boolean;
}

export interface DashboardShellStyle extends CSSProperties {
  "--eve-banner-height": string;
}

export interface DashboardSidebarStyle extends CSSProperties {
  "--sidebar-width": string;
}
