"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { SidebarInset, SidebarProvider } from "@notra/ui/components/ui/sidebar";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import { isDemoModeClient } from "@notra/utils/demo-mode";
import { Suspense, useEffect } from "react";
import { useTranslations } from "use-intl";

import { AnalyticsImportWatcher } from "@/components/analytics-import/analytics-import-watcher";
import { SubscriptionGate } from "@/components/billing/subscription-gate";
import { AgentPromptBar } from "@/components/dashboard/agent-prompt-bar";
import { DashboardSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardGlobalActions } from "@/components/dashboard/dashboard-global-actions";
import { SiteHeader } from "@/components/dashboard/header";
import { RightPanel } from "@/components/dashboard/right-panel";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { AUTOPILOT_ONBOARDING_LAYER_ID } from "@/constants/autopilot-onboarding";
import { RIGHT_PANEL_PORTAL_ID } from "@/constants/right-panel";
import { useAgentPromptBarVisible } from "@/lib/hooks/use-agent-prompt-bar-visible";
import { useDashboardBanner } from "@/lib/hooks/use-dashboard-banner";
import { useDashboardRootMarker } from "@/lib/hooks/use-dashboard-root-marker";
import { useDemoBannerVisible } from "@/lib/hooks/use-demo-banner-visible";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useSidebarWidth } from "@/lib/hooks/use-sidebar-width";
import { useWelcomeTour } from "@/lib/hooks/use-welcome-tour";
import { usePathname } from "@/lib/navigation";
import type {
  DashboardShellProps,
  DashboardSidebarStyle,
} from "@/types/components/dashboard-shell";
import { dashboardShellStyle } from "@/utils/dashboard-shell-style";
import dynamic from "@/utils/lazy-component";
import { lazyPage } from "@/utils/lazy-page";

const DashboardDemoChrome = dynamic(() =>
  import("@/components/demo/dashboard-demo-chrome").then(
    (module) => module.DashboardDemoChrome
  )
);
const DemoPlaygroundProvider = dynamic(() =>
  import("@/components/demo/demo-playground-provider").then(
    (module) => module.DemoPlaygroundProvider
  )
);

const DashboardBanner = dynamic(() =>
  import("@/components/dashboard/dashboard-banner").then(
    (module) => module.DashboardBanner
  )
);

const WelcomeTour = dynamic(() =>
  import("@/components/dashboard/welcome-tour").then(
    (module) => module.WelcomeTour
  )
);

function DashboardAgentPanelSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <Skeleton className="h-8 w-32" />
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-16 w-3/5 self-end" />
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function DashboardAgentHostLoading() {
  const t = useTranslations("dashboard.agent");
  const { active, closePanel, expanded } = useRightPanel();
  const isDesktop = useDesktopBreakpoint();

  if (isDesktop) {
    return <DashboardAgentPanelSkeleton />;
  }

  return (
    <ResponsiveDialog
      onOpenChange={(open) => {
        if (!open) {
          closePanel("agent");
        }
      }}
      open={active === "agent"}
    >
      <ResponsiveDialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          expanded
            ? "h-svh max-h-svh max-w-none rounded-none sm:max-w-none"
            : "h-[85svh] max-h-[85svh] sm:max-w-md"
        )}
        drawerClassName={cn(
          "[&>*:not([data-slot=sheet-header]):not([data-slot=sheet-footer]):not([data-slot=sheet-close])]:px-0",
          expanded && "h-svh max-h-svh rounded-none"
        )}
        showCloseButton={false}
      >
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>{t("loadingTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("loadingDescription")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <DashboardAgentPanelSkeleton />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// Renders without suspending once its chunk is in, so warming it below means
// the first open shows the real panel instead of a skeleton.
const DashboardAgentHost = lazyPage(() =>
  import("@/components/dashboard/dashboard-agent-panel").then((module) => ({
    default: module.DashboardAgentHost,
  }))
);

function useWarmDashboardAgent() {
  useEffect(() => {
    const warm = () => {
      DashboardAgentHost.preload().catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(handle);
  }, []);
}

function DashboardAgentSlot() {
  const { hasOpened } = useRightPanel();
  // The panel only exists in the browser; the server renders nothing here.
  const isClient = useIsClient();
  useWarmDashboardAgent();

  if (!isClient) {
    return null;
  }

  return (
    <RightPanel id="agent" surface="shell">
      {hasOpened.agent ? (
        <Suspense fallback={<DashboardAgentHostLoading />}>
          <DashboardAgentHost />
        </Suspense>
      ) : null}
    </RightPanel>
  );
}

const DailyBriefOverlay = dynamic(
  () =>
    import("@/components/dashboard/daily-brief-overlay").then(
      (module) => module.DailyBriefOverlay
    ),
  { ssr: false }
);

function DashboardPageViewport({
  children,
}: Pick<DashboardShellProps, "children">) {
  const pathname = usePathname();
  const [, , section, contentId] = pathname.split("/");
  const pageOwnsScroll =
    section === "chat" || (section === "content" && Boolean(contentId));
  const promptBarVisible = useAgentPromptBarVisible();

  return (
    <div
      className={cn(
        "@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-2 overscroll-contain has-[[data-site-frame]]:overflow-hidden pointer-fine:overscroll-none",
        // Room to scroll the last row out from under the floating composer.
        promptBarVisible && "pb-24",
        pageOwnsScroll
          ? "overflow-hidden"
          : "scrollbar-stable scrollbar-thin overflow-x-hidden overflow-y-auto"
      )}
    >
      {children}
    </div>
  );
}

export function DashboardShell({
  children,
  demoBannerHidden,
  initialSidebarOpen,
  initialSidebarWidth,
}: DashboardShellProps) {
  const { activeOrganization } = useOrganizationsContext();
  const { expanded } = useRightPanel();
  const demo = isDemoModeClient();
  const showDemoBanner = useDemoBannerVisible(demoBannerHidden);
  const welcomeTour = useWelcomeTour();
  const banner = useDashboardBanner();
  const shellStyle = dashboardShellStyle(showDemoBanner, !!banner);
  const {
    finishSidebarResize,
    setSidebarWidth,
    sidebarResizing,
    sidebarWidth,
    startSidebarResize,
  } = useSidebarWidth(initialSidebarWidth);
  useDashboardRootMarker();

  const sidebarStyle: DashboardSidebarStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
  };

  const shell = (
    <div
      className="bg-sidebar flex h-svh flex-col overflow-hidden overscroll-none"
      data-dashboard-shell
      style={shellStyle}
    >
      {demo ? (
        <div
          className={
            showDemoBanner ? "h-(--demo-banner-height) shrink-0" : "contents"
          }
        >
          <DashboardDemoChrome showBanner={showDemoBanner} />
        </div>
      ) : null}
      {banner ? (
        <div className="h-(--dashboard-banner-height) shrink-0">
          <DashboardBanner {...banner} />
        </div>
      ) : null}
      <SidebarProvider
        className={cn(
          "min-h-0! flex-1 overflow-hidden overscroll-none",
          sidebarResizing &&
            "[&_[data-slot=sidebar-gap]]:transition-none! [&_[data-slot=sidebar-inset]]:transition-none!"
        )}
        defaultOpen={initialSidebarOpen}
        style={sidebarStyle}
      >
        <DashboardSidebar
          className="transition-[left,right,width,top,height] [transition-duration:var(--sidebar-duration),var(--sidebar-duration),var(--sidebar-duration),200ms,200ms] [transition-timing-function:var(--sidebar-ease),var(--sidebar-ease),var(--sidebar-ease),ease-out,ease-out] motion-reduce:transition-none md:top-(--top-banner-height) md:h-[calc(100svh-var(--top-banner-height))]"
          onWidthChange={setSidebarWidth}
          onWidthChangeEnd={finishSidebarResize}
          onWidthChangeStart={startSidebarResize}
          resizing={sidebarResizing}
          variant="inset"
          width={sidebarWidth}
        />
        <SidebarInset
          className={cn(
            "min-h-0 min-w-0 overflow-hidden",
            expanded && "hidden"
          )}
        >
          <SiteHeader />
          <DashboardPageViewport>
            <SubscriptionGate>{children}</SubscriptionGate>
          </DashboardPageViewport>
          <AgentPromptBar />
          <div className="contents" id={AUTOPILOT_ONBOARDING_LAYER_ID} />
        </SidebarInset>
        <div className="contents" id={RIGHT_PANEL_PORTAL_ID} />
        <DashboardAgentSlot />
        <DailyBriefOverlay />
      </SidebarProvider>
      <DashboardGlobalActions />
      <AnalyticsImportWatcher />
      {welcomeTour.open ? (
        <WelcomeTour
          brandName={activeOrganization?.name}
          onClose={welcomeTour.close}
        />
      ) : null}
    </div>
  );

  return demo ? (
    <DemoPlaygroundProvider>{shell}</DemoPlaygroundProvider>
  ) : (
    shell
  );
}
