"use client";

import {
  AtIcon,
  BotIcon,
  Globe02Icon,
  McpServerIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs } from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { WEB_ANALYTICS_NAV_LINK } from "@/constants/geo-traffic-pages";
import { MCP_ANALYTICS_NAV_LINK } from "@/constants/mcp-analytics";
import { ANALYTICS_NAV_LINK } from "@/constants/nav";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";
import { useParams, usePathname } from "@/lib/navigation";
import type { AnalyticsSourceTabsProps } from "@/types/analytics";
import { geoTrafficPath, withGeoProject } from "@/utils/geo-paths";

/**
 * Switches Analytics between AI agents, people, MCP server and social. Every tab and
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
  const webPath = `/${slug}${WEB_ANALYTICS_NAV_LINK}`;
  const mcpPath = `/${slug}${MCP_ANALYTICS_NAV_LINK}`;
  const socialPath = `/${slug}${ANALYTICS_NAV_LINK}`;
  let value = "agents";
  if (pathname.startsWith(webPath)) {
    value = "web";
  } else if (pathname.startsWith(mcpPath)) {
    value = "mcp";
  } else if (pathname.startsWith(socialPath)) {
    value = "social";
  }

  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
      {/* Narrow screens scroll the tabs instead of clipping the last ones. */}
      <Tabs
        className="max-w-full min-w-0 scrollbar-none overflow-x-auto"
        value={value}
      >
        <IconTabsList
          aria-label={t("label")}
          // Every source page (and its skeleton) renders its own copy; the
          // shared indicator slides from the tab the last copy showed.
          indicatorId="analytics-source"
          value={value}
        >
          <IconTabsTrigger
            icon={<HugeiconsIcon icon={BotIcon} size={15} />}
            nativeButton={false}
            render={<Link href={geoTrafficPath(slug, projectId)} />}
            value="agents"
          >
            {t("agents")}
          </IconTabsTrigger>
          <IconTabsTrigger
            icon={<HugeiconsIcon icon={Globe02Icon} size={15} />}
            nativeButton={false}
            render={<Link href={withGeoProject(webPath, projectId)} />}
            value="web"
          >
            {t("web")}
          </IconTabsTrigger>
          <IconTabsTrigger
            icon={<HugeiconsIcon icon={McpServerIcon} size={15} />}
            nativeButton={false}
            render={<Link href={withGeoProject(mcpPath, projectId)} />}
            value="mcp"
          >
            {t("mcp")}
          </IconTabsTrigger>
          {showSocial || value === "social" ? (
            <IconTabsTrigger
              icon={<HugeiconsIcon icon={AtIcon} size={15} />}
              nativeButton={false}
              render={<Link href={withGeoProject(socialPath, projectId)} />}
              value="social"
            >
              {t("social")}
            </IconTabsTrigger>
          ) : null}
        </IconTabsList>
      </Tabs>
      {actions ? (
        <div className="flex min-h-7 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
