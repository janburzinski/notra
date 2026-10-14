"use client";

import { useEffect, useState } from "react";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { SIDEBAR_MODE_HOME_LINKS } from "@/constants/nav";
import { useDeferredMount } from "@/lib/hooks/use-deferred-mount";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useSidebarMode } from "@/lib/hooks/use-sidebar-mode";
import { usePathname, useRouter } from "@/lib/navigation";
import type { SidebarMode } from "@/types/components/nav";
import { geoNavHref } from "@/utils/geo-paths";
import {
  canPrefetchSidebarModeHome,
  sidebarRouteFromPathname,
} from "@/utils/nav";

import { NavGeo } from "./nav-geo";
import { NavModePrimaryAction } from "./nav-mode-primary-action";
import { NavModeSwitch } from "./nav-mode-switch";
import { NavStudio } from "./nav-studio";
import { SidebarSwap } from "./sidebar-swap";

export function NavMain() {
  const { activeOrganization } = useOrganizationsContext();
  const pathname = usePathname();
  const router = useRouter();
  const [projectParam] = useGeoProjectQueryState();
  const route = sidebarRouteFromPathname(pathname);
  const { mode, setMode, pendingMode } = useSidebarMode(route);
  const idleReady = useDeferredMount();
  const [recentWarmed, setRecentWarmed] = useState(mode === "studio");
  const slug = activeOrganization?.slug;
  const projectId = projectParam ?? undefined;
  const loadRecent = mode === "studio" || recentWarmed || idleReady;

  const prefetchModeHome = (next: SidebarMode) => {
    if (!slug || next === mode) {
      return;
    }
    if (next === "studio") {
      setRecentWarmed(true);
    }
    if (!canPrefetchSidebarModeHome(next)) {
      return;
    }
    router.prefetch(geoNavHref(slug, SIDEBAR_MODE_HOME_LINKS[next], projectId));
  };

  useEffect(() => {
    if (!slug) {
      return;
    }
    const other: SidebarMode = mode === "studio" ? "geo" : "studio";
    if (!canPrefetchSidebarModeHome(other)) {
      return;
    }
    router.prefetch(
      geoNavHref(slug, SIDEBAR_MODE_HOME_LINKS[other], projectId)
    );
  }, [mode, slug, projectId, router]);

  if (!slug || !activeOrganization) {
    return null;
  }

  const navPathname = pendingMode
    ? `/${slug}${SIDEBAR_MODE_HOME_LINKS[pendingMode]}`
    : pathname;

  const handleModeChange = (next: SidebarMode) => {
    setMode(next);
    prefetchModeHome(next);
    router.push(geoNavHref(slug, SIDEBAR_MODE_HOME_LINKS[next], projectId));
  };

  return (
    <>
      <NavModeSwitch
        mode={mode}
        onModeChange={handleModeChange}
        onPrefetchMode={prefetchModeHome}
        projectId={projectId}
        slug={slug}
      />
      <NavModePrimaryAction
        mode={mode}
        organizationId={activeOrganization.id}
        projectId={projectId}
        slug={slug}
      />
      <SidebarSwap
        activeId={mode}
        className="overflow-hidden"
        items={[
          {
            id: "geo",
            side: "left",
            children: (
              <NavGeo
                pathname={navPathname}
                projectId={projectId}
                slug={slug}
              />
            ),
          },
          {
            id: "studio",
            side: "right",
            children: (
              <NavStudio
                loadRecent={loadRecent}
                organizationId={activeOrganization.id}
                pathname={navPathname}
                slug={slug}
              />
            ),
          },
        ]}
        keepMounted
      />
    </>
  );
}
