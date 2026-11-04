"use client";

import { AtIcon, Globe02Icon, McpServerIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { MCP_ANALYTICS_NAV_LINK } from "@/constants/mcp-analytics";
import { ANALYTICS_NAV_LINK } from "@/constants/nav";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";
import { useParams, usePathname } from "@/lib/navigation";
import type { AnalyticsSourceTabsProps } from "@/types/analytics";
import { geoTrafficPath, withGeoProject } from "@/utils/geo-paths";

// Every source is its own route, so the tab list remounts on each switch.
// Remembering the last active tab lets the new list start there and slide.
let lastSourceTab: string | null = null;

/**
 * Switches Analytics between website, MCP server and social. Every tab and
 * loading state renders it at the same height, so switching never moves the
 * content below it.
 */
export function AnalyticsSourceTabs({ actions }: AnalyticsSourceTabsProps) {
  const t = useTranslations("analytics.sources");
  const pathname = usePathname();
  const { slug = "" } = useParams<{ slug?: string }>();
  const { projectId: scopedProjectId } = useGeoProjectScope();
  // Social sits outside the GEO project provider, so it keeps the project in
  // the URL for the way back.
  const [projectParam] = useGeoProjectQueryState();
  const projectId = scopedProjectId ?? projectParam ?? undefined;
  const { analytics: showSocial } = useNavVisibility();
  const mcpPath = `/${slug}${MCP_ANALYTICS_NAV_LINK}`;
  const socialPath = `/${slug}${ANALYTICS_NAV_LINK}`;
  let value = "website";
  if (pathname.startsWith(mcpPath)) {
    value = "mcp";
  } else if (pathname.startsWith(socialPath)) {
    value = "social";
  }
  const [shownValue, setShownValue] = useState(() => lastSourceTab ?? value);
  useEffect(() => {
    lastSourceTab = value;
    if (shownValue === value) {
      return;
    }
    // One frame at the old tab so the indicator has a position to slide from.
    const frame = requestAnimationFrame(() => setShownValue(value));
    return () => cancelAnimationFrame(frame);
  }, [shownValue, value]);

  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
      <Tabs value={shownValue}>
        <TabsList aria-label={t("label")}>
          <TabsTrigger
            nativeButton={false}
            render={<Link href={geoTrafficPath(slug, projectId)} />}
            value="website"
          >
            <HugeiconsIcon aria-hidden="true" icon={Globe02Icon} />
            {t("website")}
          </TabsTrigger>
          <TabsTrigger
            nativeButton={false}
            render={<Link href={withGeoProject(mcpPath, projectId)} />}
            value="mcp"
          >
            <HugeiconsIcon aria-hidden="true" icon={McpServerIcon} />
            {t("mcp")}
          </TabsTrigger>
          {showSocial || value === "social" ? (
            <TabsTrigger
              nativeButton={false}
              render={<Link href={withGeoProject(socialPath, projectId)} />}
              value="social"
            >
              <HugeiconsIcon aria-hidden="true" icon={AtIcon} />
              {t("social")}
            </TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>
      {actions ? (
        <div className="flex min-h-7 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
