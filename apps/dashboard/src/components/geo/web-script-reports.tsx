"use client";

import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { useLocale, useTranslations } from "use-intl";

import { LanguageFlag } from "@/components/geo/twemoji";
import { WebBreakdownTable } from "@/components/geo/web-breakdown-table";
import { WebOutboundFavicon } from "@/components/geo/web-outbound-favicon";
import { WebScriptEmpty } from "@/components/geo/web-script-empty";
import { WebVitalsCard } from "@/components/geo/web-vitals-card";
import { WEB_LIST_LIMIT } from "@/constants/web-analytics";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import type { WebBreakdownRow, WebScriptReportsProps } from "@/types/geo";
import { languageName, webTableHeight } from "@/utils/web-analytics";

/**
 * Reports only notra.js sends: outbound links, languages and web vitals,
 * plus script errors when there are any.
 * Same tables and pairing as WebVisitorsSection.
 */
export function WebScriptReports({
  reports,
  loading,
  compare,
}: WebScriptReportsProps) {
  const t = useTranslations("geo.webVisitors");
  const locale = useLocale();
  const sideBySide = useDesktopBreakpoint();

  const outboundRows: WebBreakdownRow[] = (reports?.outboundLinks ?? [])
    .slice(0, WEB_LIST_LIMIT)
    .map((link) => ({
      key: link.url,
      label: (
        <>
          <WebOutboundFavicon url={link.url} />
          <TruncateWithTooltip tooltip={link.url}>
            {link.url}
          </TruncateWithTooltip>
        </>
      ),
      sortLabel: link.url,
      value: link.clicks,
      previous: link.previousClicks,
    }));
  const languageRows: WebBreakdownRow[] = (reports?.languages ?? [])
    .slice(0, WEB_LIST_LIMIT)
    .map((row) => {
      const name = languageName(row.value, locale);
      return {
        key: row.value,
        label: (
          <>
            <LanguageFlag className="size-3.5 shrink-0" language={row.value} />
            <span className="truncate">{name}</span>
          </>
        ),
        sortLabel: name,
        value: row.visitors,
        previous: row.previousVisitors,
      };
    });
  const errorRows: WebBreakdownRow[] = (reports?.errors ?? [])
    .slice(0, WEB_LIST_LIMIT)
    .map((error) => ({
      key: error.message,
      label: (
        <TruncateWithTooltip tooltip={`${error.message}\n${error.source}`}>
          {error.message}
        </TruncateWithTooltip>
      ),
      sortLabel: error.message,
      value: error.events,
    }));

  let audienceHeight: number | undefined;
  if (loading) {
    audienceHeight = webTableHeight(WEB_LIST_LIMIT);
  } else if (sideBySide) {
    audienceHeight = Math.max(
      webTableHeight(outboundRows.length),
      webTableHeight(languageRows.length)
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <WebBreakdownTable
          compare={compare}
          emptyState={
            <WebScriptEmpty
              description={t("outboundEmptyDescription")}
              title={t("outboundEmptyTitle")}
            />
          }
          height={audienceHeight}
          loading={loading}
          nameHeader={t("columnLink")}
          rows={outboundRows}
          title={t("outboundLinks")}
          valueHeader={t("columnClicks")}
        />
        <WebBreakdownTable
          compare={compare}
          height={audienceHeight}
          loading={loading}
          nameHeader={t("columnLanguage")}
          rows={languageRows}
          title={t("languages")}
          valueHeader={t("visitors")}
        />
      </div>
      <WebVitalsCard loading={loading} reports={reports} />
      {!loading && errorRows.length > 0 ? (
        <WebBreakdownTable
          compare={false}
          nameHeader={t("columnError")}
          rows={errorRows}
          title={t("errors")}
          valueHeader={t("columnEvents")}
        />
      ) : null}
    </>
  );
}
