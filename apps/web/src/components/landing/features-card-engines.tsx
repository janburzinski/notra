import { GeoBar } from "@notra/ui/components/geo/geo-bar";
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
  FEATURES_ENGINE_ROWS,
  FEATURES_TABLE_OPTIONAL_COL,
} from "@/constants/landing/features";
import { GEO_ENGINE_NAMES } from "@/constants/landing/geo-engines";

const HEADER_CLASS = "text-muted-foreground text-xs";
const RATE_MAX = 100;
const RATE_COL = "w-[8.25rem]";
const POSITION_COL = "w-[6.75rem]";
const CHECKED_COL = "w-[6.5rem]";

export function FeaturesCardEngines() {
  const t = useTranslations("landing.features.engines");
  const format = useFormatter();
  return (
    <MockFrame heading={t("heading")} subhead={t("subhead")}>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>
              {t("headers.engine")}
            </TableHead>
            <TableHead className={cn(HEADER_CLASS, RATE_COL)}>
              {t("headers.mentionRate")}
            </TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                POSITION_COL
              )}
            >
              {t("headers.avgPosition")}
            </TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                CHECKED_COL
              )}
            >
              {t("headers.lastChecked")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURES_ENGINE_ROWS.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="min-w-0 overflow-hidden py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <LandingEngineIcon className="shrink-0" engine={row.id} />
                  <span className="truncate">{GEO_ENGINE_NAMES[row.id]}</span>
                </span>
              </TableCell>
              <TableCell className={cn("py-3", RATE_COL)}>
                <span className="flex items-center gap-2">
                  <GeoBar
                    className="h-1.5 w-10 @lg:w-16"
                    max={RATE_MAX}
                    value={row.mentionRate}
                  />
                  <span className="text-sm tabular-nums">
                    {format.number(row.mentionRate / RATE_MAX, {
                      style: "percent",
                    })}
                  </span>
                </span>
              </TableCell>
              <TableCell
                className={cn(
                  "text-muted-foreground py-3 text-sm tabular-nums",
                  FEATURES_TABLE_OPTIONAL_COL,
                  POSITION_COL
                )}
              >
                #{format.number(row.avgPosition)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-muted-foreground py-3 text-sm",
                  FEATURES_TABLE_OPTIONAL_COL,
                  CHECKED_COL
                )}
              >
                {t("hoursAgo", { count: row.lastCheckedHours })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
