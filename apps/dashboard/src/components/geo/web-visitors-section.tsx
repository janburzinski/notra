"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { trafficLogHostFilter } from "@notra/geo-core/utils/geo-project-domains";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { useLocale, useTranslations } from "use-intl";

import { CountryFlag } from "@/components/geo/twemoji";
import { WebBreakdownTable } from "@/components/geo/web-breakdown-table";
import { WebOutcomesTable } from "@/components/geo/web-outcomes-table";
import { WebReferrerIcon } from "@/components/geo/web-referrer-icon";
import { WebScriptReports } from "@/components/geo/web-script-reports";
import { WebSourcesCard } from "@/components/geo/web-sources-card";
import { WebTrafficHero } from "@/components/geo/web-traffic-hero";
import {
  WEB_DEVICE_ICONS,
  WEB_LIST_LIMIT,
  WEB_UNKNOWN_DEVICE_ICON,
} from "@/constants/web-analytics";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import type { WebBreakdownRow, WebVisitorsSectionProps } from "@/types/geo";
import { countryName } from "@/utils/country";
import {
  hasPreviousWebPeriod,
  webSourceName,
  webTableHeight,
} from "@/utils/web-analytics";

export function WebVisitorsSection({
  web,
  traffic,
  range,
  engagement,
  breakdownsPending = false,
  showScriptReports = false,
  utm,
}: WebVisitorsSectionProps) {
  const t = useTranslations("geo.webVisitors");
  const locale = useLocale();
  const sideBySide = useDesktopBreakpoint();
  const compare = hasPreviousWebPeriod(web);

  const showPageHost = new Set(web.pages.map((page) => page.host)).size > 1;
  const pageRows: WebBreakdownRow[] = web.pages
    .slice(0, WEB_LIST_LIMIT)
    .map((page) => {
      const url = `${page.host}${page.path}`;
      return {
        key: url,
        label: (
          <TruncateWithTooltip tooltip={url}>
            {showPageHost ? (
              <span className="text-muted-foreground">
                {trafficLogHostFilter(page.host)}
              </span>
            ) : null}
            {page.path}
          </TruncateWithTooltip>
        ),
        sortLabel: url,
        value: page.views,
        previous: page.previousViews,
        fromAi: page.aiVisitors,
      };
    });
  // Every source the API returns; the table scrolls past WEB_LIST_LIMIT rows.
  const sourceRows: WebBreakdownRow[] = web.sources.map((source) => {
    const name = webSourceName(source, t("direct"));
    return {
      key: `${source.group}:${source.source}`,
      label: (
        <>
          <WebReferrerIcon source={source} />
          <span className="truncate">{name}</span>
        </>
      ),
      sortLabel: name,
      value: source.sessions,
      previous: source.previousSessions,
    };
  });
  const countryRows: WebBreakdownRow[] = web.countries.map((row) => {
    const name = row.value
      ? countryName(row.value, locale)
      : t("unknownCountry");
    return {
      key: row.value || "unknown",
      label: (
        <>
          {row.value ? (
            <CountryFlag className="size-3.5" code={row.value} />
          ) : null}
          <span className="truncate">{name}</span>
        </>
      ),
      sortLabel: name,
      value: row.visitors,
      previous: row.previousVisitors,
    };
  });
  const deviceLabels: Record<string, string> = {
    desktop: t("deviceDesktop"),
    mobile: t("deviceMobile"),
    tablet: t("deviceTablet"),
  };
  const deviceRows: WebBreakdownRow[] = web.devices.map((row) => {
    const known = Object.hasOwn(deviceLabels, row.value);
    const name = (known && deviceLabels[row.value]) || t("deviceUnknown");
    const icon =
      (known && WEB_DEVICE_ICONS[row.value]) || WEB_UNKNOWN_DEVICE_ICON;
    return {
      key: row.value || "unknown",
      label: (
        <>
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground size-3.5 shrink-0"
            icon={icon}
          />
          <span className="truncate">{name}</span>
        </>
      ),
      sortLabel: name,
      value: row.visitors,
      previous: row.previousVisitors,
    };
  });

  const pairHeight = (first: number, second: number) => {
    if (breakdownsPending) {
      return webTableHeight(WEB_LIST_LIMIT);
    }
    return sideBySide
      ? webTableHeight(Math.min(Math.max(first, second), WEB_LIST_LIMIT))
      : undefined;
  };
  const topHeight = pairHeight(pageRows.length, sourceRows.length);
  const audienceHeight = pairHeight(countryRows.length, deviceRows.length);

  return (
    <section className="flex flex-col gap-6">
      <WebTrafficHero
        engagement={engagement}
        range={range}
        traffic={traffic}
        web={web}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <WebBreakdownTable
          compare={compare}
          height={topHeight}
          nameHeader={t("page")}
          rows={pageRows}
          showFromAi
          title={t("topPages")}
          loading={breakdownsPending}
          valueHeader={t("columnViews")}
        />
        {utm ? (
          <WebSourcesCard
            compare={compare}
            height={topHeight}
            loading={breakdownsPending}
            range={range}
            sourceRows={sourceRows}
            utm={utm}
          />
        ) : (
          <WebBreakdownTable
            compare={compare}
            height={topHeight}
            nameHeader={t("columnSource")}
            rows={sourceRows}
            title={t("referrers")}
            loading={breakdownsPending}
            valueHeader={t("sessions")}
          />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WebBreakdownTable
          compare={compare}
          height={audienceHeight}
          nameHeader={t("columnCountry")}
          rows={countryRows}
          title={t("countries")}
          loading={breakdownsPending}
          valueHeader={t("visitors")}
        />
        <WebBreakdownTable
          compare={compare}
          height={audienceHeight}
          nameHeader={t("columnDevice")}
          rows={deviceRows}
          title={t("devices")}
          loading={breakdownsPending}
          valueHeader={t("visitors")}
        />
      </div>
      <WebOutcomesTable loading={breakdownsPending} outcomes={web.outcomes} />
      {showScriptReports ? (
        <WebScriptReports
          compare={compare}
          loading={breakdownsPending}
          reports={web.script}
        />
      ) : null}
    </section>
  );
}
