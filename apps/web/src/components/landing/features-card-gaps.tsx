import { GapMeter } from "@notra/ui/components/geo/gap-meter";
import { LogoStack } from "@notra/ui/components/geo/logo-stack";
import { Button } from "@notra/ui/components/ui/button";
import { GEO_GAPS_METER_STEPS } from "@notra/ui/constants/geo";
import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

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
  FEATURES_GAP_ROWS,
  FEATURES_TABLE_OPTIONAL_COL,
} from "@/constants/landing/features";
import { GEO_ENGINE_NAMES } from "@/constants/landing/geo-engines";

const HEADER_CLASS = "text-muted-foreground text-xs";
const OPPORTUNITY_COL = "w-[7.5rem]";
const MISSING_COL = "w-[7.5rem]";
const ACTION_COL = "w-[5.75rem]";

export function FeaturesCardGaps() {
  const t = useTranslations("landing.features.gaps");
  return (
    <MockFrame heading={t("heading")} subhead={t("subhead")}>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>
              {t("headers.content")}
            </TableHead>
            <TableHead className={cn(HEADER_CLASS, OPPORTUNITY_COL)}>
              {t("headers.opportunity")}
            </TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                MISSING_COL
              )}
            >
              {t("headers.missing")}
            </TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                ACTION_COL
              )}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURES_GAP_ROWS.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="min-w-0 overflow-hidden py-3">
                <span className="block truncate text-sm font-medium">
                  {t(`rows.${row.id}`)}
                </span>
              </TableCell>
              <TableCell className={cn("py-3", OPPORTUNITY_COL)}>
                <GapMeter
                  label={t("meterLabel", {
                    rate: row.mentionRate,
                    level: row.opportunity,
                    steps: GEO_GAPS_METER_STEPS,
                  })}
                  level={row.opportunity}
                />
              </TableCell>
              <TableCell
                className={cn("py-3", FEATURES_TABLE_OPTIONAL_COL, MISSING_COL)}
              >
                <LogoStack
                  items={row.missing.map((engine) => ({
                    key: engine,
                    label: GEO_ENGINE_NAMES[engine],
                    renderIcon: (className) => (
                      <LandingEngineIcon
                        className={className}
                        engine={engine}
                      />
                    ),
                  }))}
                />
              </TableCell>
              <TableCell
                className={cn("py-3", FEATURES_TABLE_OPTIONAL_COL, ACTION_COL)}
              >
                <Button size="sm" variant="outline">
                  {t("headers.action")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
