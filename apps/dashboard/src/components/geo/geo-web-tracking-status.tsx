"use client";

import { Spinner } from "@notra/ui/components/ui/spinner";
import { useFormatter, useTranslations } from "use-intl";

import Link from "@/components/framework/link";
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
      className="bg-muted/50 text-muted-foreground flex min-h-10 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-sm"
      role="status"
    >
      {firstDay ? (
        <>
          <span
            aria-hidden="true"
            className="bg-success size-2 shrink-0 rounded-full"
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
          <Spinner aria-hidden="true" className="size-4" />
          <span>{t("awaiting")}</span>
        </>
      )}
    </div>
  );
}
