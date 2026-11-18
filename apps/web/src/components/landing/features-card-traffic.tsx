import { PurposeBadge } from "@notra/ui/components/geo/purpose-badge";
import { StatTiles } from "@notra/ui/components/geo/stat-tiles";
import { cn } from "@notra/ui/lib/utils";
import { useFormatter, useTranslations } from "use-intl";

import { LandingEngineIcon } from "@/components/landing/landing-engine-icon";
import { MockFrame } from "@/components/landing/mock-frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/marketing-table";
import {
  FEATURES_TABLE_OPTIONAL_COL,
  FEATURES_TRAFFIC_KPIS,
  FEATURES_TRAFFIC_ROWS,
} from "@/constants/landing/features";

const HEADER_CLASS = "text-muted-foreground text-xs";
const VISITS_COL = "w-16";
const LAST_SEEN_COL = "w-[5.5rem]";
const SECONDS_PER_MINUTE = 60;

export function FeaturesCardTraffic() {
  const t = useTranslations("landing.features");
  const format = useFormatter();
  return (
    <MockFrame heading={t("traffic.heading")} subhead={t("traffic.subhead")}>
      <StatTiles
        className="border-border grid-cols-3 divide-x divide-y-0 border-b max-sm:[&_span]:text-xl max-sm:[&>div]:px-3 max-sm:[&>div]:py-3"
        tiles={FEATURES_TRAFFIC_KPIS.map((kpi) => ({
          key: kpi.id,
          label: t(`traffic.kpis.${kpi.id}`),
          value: format.number(kpi.value),
        }))}
      />
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>
              {t("traffic.headers.source")}
            </TableHead>
            <TableHead className={cn(HEADER_CLASS, "w-[11.5rem]")}>
              {t("traffic.headers.purpose")}
            </TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                VISITS_COL
              )}
            >
              {t("traffic.headers.visits")}
            </TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                LAST_SEEN_COL
              )}
            >
              {t("traffic.headers.lastSeen")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURES_TRAFFIC_ROWS.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="min-w-0 overflow-hidden py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <LandingEngineIcon className="shrink-0" engine={row.engine} />
                  <span className="truncate">{row.source}</span>
                </span>
              </TableCell>
              <TableCell className="w-[11.5rem] overflow-hidden py-3">
                <PurposeBadge
                  category={row.purpose}
                  description={t(`purposes.${row.purpose}.description`)}
                  label={t(`purposes.${row.purpose}.label`)}
                />
              </TableCell>
              <TableCell
                className={cn(
                  "py-3 text-sm tabular-nums",
                  FEATURES_TABLE_OPTIONAL_COL,
                  VISITS_COL
                )}
              >
                {format.number(row.visits)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-muted-foreground py-3 text-sm",
                  FEATURES_TABLE_OPTIONAL_COL,
                  LAST_SEEN_COL
                )}
              >
                {row.lastSeenSeconds < SECONDS_PER_MINUTE
                  ? t("traffic.secondsAgo", { count: row.lastSeenSeconds })
                  : t("traffic.minutesAgo", {
                      count: row.lastSeenSeconds / SECONDS_PER_MINUTE,
                    })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
