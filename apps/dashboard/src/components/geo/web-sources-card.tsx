"use client";

import { WEB_UTM_DIMENSIONS } from "@notra/geo-core/constants/web-analytics";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { WebBreakdownTable } from "@/components/geo/web-breakdown-table";
import { WebScriptEmpty } from "@/components/geo/web-script-empty";
import { WEB_LIST_LIMIT } from "@/constants/web-analytics";
import { useWebUtm } from "@/lib/hooks/use-geo";
import type {
  WebBreakdownRow,
  WebSourcesCardProps,
  WebSourcesPick,
} from "@/types/geo";

/**
 * Where sessions came from: referrers, or one UTM parameter, picked in the
 * name column's header so the card keeps the same frame as Top pages.
 */
export function WebSourcesCard({
  sourceRows,
  utm,
  range,
  height,
  compare,
  loading,
}: WebSourcesCardProps) {
  const t = useTranslations("geo.webVisitors");
  const [pick, setPick] = useState<WebSourcesPick>("referrers");
  const dimension = pick === "referrers" ? null : pick;
  const utmQuery = useWebUtm(
    utm.organizationId,
    dimension ?? "source",
    range,
    utm.host,
    utm.path,
    utm.sites,
    dimension !== null
  );
  const utmRows: WebBreakdownRow[] = (utmQuery.data ?? [])
    .slice(0, WEB_LIST_LIMIT)
    .map((row) => ({
      key: row.value,
      label: <TruncateWithTooltip>{row.value}</TruncateWithTooltip>,
      sortLabel: row.value,
      value: row.sessions,
      previous: row.previousSessions,
    }));

  const picker = (
    <Select
      onValueChange={(value) => {
        const next = WEB_UTM_DIMENSIONS.find((name) => name === value);
        setPick(next ?? "referrers");
      }}
      value={pick}
    >
      <SelectTrigger
        aria-label={t("sourcesLabel")}
        className="-ml-2.5"
        variant="ghost"
      >
        <SelectValue>
          {dimension
            ? `${t("utmShort")} ${t(`utm.${dimension}`).toLowerCase()}`
            : t("referrers")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectItem value="referrers">{t("referrers")}</SelectItem>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{t("utmParameters")}</SelectLabel>
          {WEB_UTM_DIMENSIONS.map((name) => (
            <SelectItem key={name} value={name}>
              {t(`utm.${name}`)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  return (
    <WebBreakdownTable
      compare={compare}
      height={height}
      nameHeader={picker}
      nameSortable={false}
      title={t("sourcesLabel")}
      valueHeader={t("sessions")}
      {...(dimension
        ? {
            emptyState: (
              <WebScriptEmpty
                description={t("utmEmptyDescription")}
                title={t("utmEmptyTitle")}
              />
            ),
            loading: utmQuery.isPending,
            rows: utmRows,
          }
        : { loading, rows: sourceRows })}
    />
  );
}
