"use client";

import { ArrowLeft01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@notra/ui/components/ui/sidebar";
import { cn } from "@notra/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";
import type { DashboardSidebarProps } from "@/types/components/sidebar-resize-handle";
import dynamic from "@/utils/lazy-component";
import { isNavigation } from "@/utils/sidebar-navigation";

import { ChatHistoryNavLoading } from "./chat-history-nav-loading";
import { DeferredSidebarStatus } from "./deferred-sidebar-status";
import { NavFooter } from "./nav-footer";
import { NavJobs } from "./nav-jobs";
import { SidebarLabel } from "./sidebar-label";
import { SidebarNavLink } from "./sidebar-nav-link";
import { SidebarProjectSwitcher } from "./sidebar-project-switcher";
import { SidebarTopQuickActions } from "./sidebar-quick-actions";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { SidebarSwap } from "./sidebar-swap";
import { SidebarToggle } from "./sidebar-toggle";
import { SidebarUserMenu } from "./sidebar-user-menu";

const ChatHistoryNav = dynamic(
  () => import("./chat-history-nav").then((module) => module.ChatHistoryNav),
  {
    loading: () => <ChatHistoryNavLoading />,
  }
);

/**
 * Back and New chat share one row so the chat list starts higher. In the rail
 * they stack, like every other rail item.
 */
function SidebarChatTopRow({
  onBack,
  slug,
}: {
  onBack: () => void;
  slug: string;
}) {
  const t = useTranslations("common.actions");
  const tLabels = useTranslations("common.labels");
  const newChatLabel = tLabels("newChat");
  return (
    <div className="bg-sidebar sticky top-0 z-20 flex items-center gap-1 p-2 group-data-[collapsible=icon]:flex-col">
      <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:w-full">
        <SidebarMenuItem>
          <SidebarMenuButton
            className="hover:bg-sidebar-accent duration-normal cursor-pointer transition-colors [&>*]:group-data-[collapsible=icon]:-translate-x-px"
            onClick={onBack}
            tooltip={t("back")}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
            <SidebarLabel>{t("back")}</SidebarLabel>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarMenu className="w-auto shrink-0 group-data-[collapsible=icon]:w-full">
        <SidebarMenuItem>
          <SidebarMenuButton
            aria-label={newChatLabel}
            className="w-8 cursor-pointer justify-center px-0"
            render={<SidebarNavLink href={`/${slug}/chat`} replace />}
            tooltip={newChatLabel}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}

/**
 * The toggle sits beside the switcher when expanded and below it when
 * collapsed. It is positioned absolutely so both spots can be animated along
 * with the sidebar width instead of reflowing the header in one frame.
 */
function SidebarHeaderRow() {
  const { isMobile } = useSidebar();
  // The mobile sheet closes through the topbar toggle instead.
  if (isMobile) {
    return <SidebarProjectSwitcher />;
  }

  return (
    <div className="relative pr-8 transition-[padding] duration-(--sidebar-duration) ease-(--sidebar-ease) group-data-[collapsible=icon]:pr-0 group-data-[collapsible=icon]:pb-8 motion-reduce:transition-none">
      <SidebarProjectSwitcher />
      <div className="absolute top-2.5 left-[calc(100%-1.75rem)] flex transition-[left,top] duration-(--sidebar-duration) ease-(--sidebar-ease) group-data-[collapsible=icon]:top-13 group-data-[collapsible=icon]:left-0.75 motion-reduce:transition-none">
        <SidebarToggle />
      </div>
    </div>
  );
}

export function DashboardSidebar({
  className,
  onWidthChange,
  onWidthChangeEnd,
  onWidthChangeStart,
  resizing,
  width,
  ...props
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const { activeOrganization } = useOrganizationsContext();
  const navigationKey = `${pathname}?${searchParams.toString()}`;
  const pathnameSegments = pathname.split("/").filter(Boolean);
  const slug = pathnameSegments[0] ?? activeOrganization?.slug ?? "";

  const section = pathnameSegments[1];
  const panelId = section === "chat" ? section : "main";
  const isSubpage = panelId !== "main";

  const [hasMoreNavigation, setHasMoreNavigation] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scrollEndRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setHasMoreNavigation(!entry.isIntersecting);
        }
      },
      { root: node.parentElement }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hasVisitedMainRef = useRef(false);
  const previousNavigationKeyRef = useRef(navigationKey);
  useEffect(() => {
    if (!isSubpage) {
      hasVisitedMainRef.current = true;
    }
  }, [isSubpage]);

  useEffect(() => {
    if (
      isMobile &&
      isNavigation(previousNavigationKeyRef.current, navigationKey)
    ) {
      setOpenMobile(false);
    }
    previousNavigationKeyRef.current = navigationKey;
  }, [isMobile, navigationKey, setOpenMobile]);

  function handleBack() {
    if (hasVisitedMainRef.current) {
      router.back();
      return;
    }
    router.push(`/${slug}`);
  }

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className={cn(
        "overscroll-none border-none",
        resizing && "transition-none!",
        className
      )}
    >
      <SidebarHeader className="pt-px pb-0.5">
        <SidebarHeaderRow />
      </SidebarHeader>
      {/* The chat list brings its own search, so the global field steps
          aside there; ⌘K still opens the palette. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-(--sidebar-duration) ease-(--sidebar-ease) motion-reduce:transition-none",
          isSubpage ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
        )}
        inert={isSubpage ? true : undefined}
      >
        <div className="min-h-0 overflow-hidden">
          <SidebarTopQuickActions />
        </div>
      </div>
      <SidebarContent>
        <SidebarSwap
          activeId={panelId}
          className="overflow-x-clip"
          items={[
            {
              id: "main",
              side: "left",
              children: <NavJobs />,
            },
            {
              id: "chat",
              side: "right",
              children: (
                <>
                  <SidebarChatTopRow onBack={handleBack} slug={slug} />
                  <ChatHistoryNav />
                </>
              ),
            },
          ]}
        />
        {/* Workspace, Docs and the agent buttons stay in reach while a long
            chat list or navigation scrolls underneath them. */}
        <div className="bg-sidebar sticky bottom-0 z-10 mt-auto">
          {hasMoreNavigation && (
            <div
              aria-hidden
              className="from-sidebar pointer-events-none absolute inset-x-0 bottom-full h-8 bg-linear-to-t to-transparent group-data-[collapsible=icon]:hidden"
              data-sidebar="scroll-fade"
            />
          )}
          <NavFooter slug={slug} />
          <DeferredSidebarStatus />
        </div>
        <div aria-hidden className="h-px shrink-0" ref={scrollEndRef} />
      </SidebarContent>
      <SidebarFooter className="pt-1.75">
        <SidebarUserMenu />
      </SidebarFooter>
      <SidebarResizeHandle
        onWidthChange={onWidthChange}
        onWidthChangeEnd={onWidthChangeEnd}
        onWidthChangeStart={onWidthChangeStart}
        width={width}
      />
    </Sidebar>
  );
}
