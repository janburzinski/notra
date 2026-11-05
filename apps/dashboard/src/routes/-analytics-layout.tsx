import { Outlet } from "@tanstack/react-router";

import { AnalyticsProvider } from "@/components/analytics/analytics-context";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";
import type { AnalyticsRouteLayoutProps } from "@/types/ui-route";

import { UiModalProvider } from "./-ui-modal";

export default function AnalyticsRouteLayout({
  slug,
}: AnalyticsRouteLayoutProps) {
  return (
    <AnalyticsProvider organizationSlug={slug}>
      <AnalyticsShell>
        <UiModalProvider>
          <Outlet />
        </UiModalProvider>
      </AnalyticsShell>
    </AnalyticsProvider>
  );
}
