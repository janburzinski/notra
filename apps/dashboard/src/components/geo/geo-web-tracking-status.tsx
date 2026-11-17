"use client";

import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { useFormatter, useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { AgentLoader } from "@/components/icons/agent-loader";
import { WEB_ANALYTICS_NAV_LINK } from "@/constants/geo-traffic-pages";
import { useWebTrackingStatus } from "@/lib/hooks/use-web-tracking-status";
import { useParams } from "@/lib/navigation";
import type { GeoWebTrackingStatusProps } from "@/types/geo";
import { formatImportDay } from "@/utils/analytics-imports";

/** "Awaiting first page view…" until notra.js counts one, then since when it has. */
export function GeoWebTrackingStatus({
  organizationId,
}: GeoWebTrackingStatusProps) {
  const t = useTranslations("geo.geoIngestSetup.script");
  const format = useFormatter();
  const { slug = "" } = useParams<{ slug?: string }>();
  const { data } = useWebTrackingStatus(organizationId, true);
  const firstDay = data?.firstDay ?? null;

  return (
    <div
      aria-live="polite"
      className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
      role="status"
    >
      {firstDay ? (
        <>
          <span
            aria-hidden="true"
            className="bg-success size-1.5 shrink-0 rounded-full"
          />
          <span className="text-foreground">
            {t("receiving", { date: formatImportDay(format, firstDay) })}
          </span>
          <Link
            className="hover:text-foreground underline-offset-4 hover:underline"
            href={`/${slug}${WEB_ANALYTICS_NAV_LINK}`}
          >
            {t("viewAnalytics")}
          </Link>
        </>
      ) : (
        <>
          <AgentLoader className="text-foreground/75 size-3" />
          <Shimmer as="span">{t("awaiting")}</Shimmer>
        </>
      )}
    </div>
  );
}
