import { cn } from "@notra/ui/lib/utils";

import { MockFrame } from "@/components/landing/mock-frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/marketing-table";
import { AUTOPILOT_RESULTS_CARD } from "@/constants/feature-pages/autopilot";
import { FEATURES_TABLE_OPTIONAL_COL } from "@/constants/landing/features";

const HEADER_CLASS = "text-muted-foreground text-xs";
const METRIC_COL = "w-[9.5rem]";
const RESULT_COL = "w-28";

export function AutopilotCardResults() {
  const { frame, headers, rows } = AUTOPILOT_RESULTS_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>{headers.change}</TableHead>
            <TableHead
              className={cn(
                HEADER_CLASS,
                FEATURES_TABLE_OPTIONAL_COL,
                METRIC_COL
              )}
            >
              {headers.metric}
            </TableHead>
            <TableHead className={cn(HEADER_CLASS, RESULT_COL)}>
              {headers.result}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.change}>
              <TableCell className="min-w-0 py-3">
                <span className="block truncate text-sm font-medium">
                  {row.change}
                </span>
              </TableCell>
              <TableCell
                className={cn(
                  "text-muted-foreground py-3 text-sm",
                  FEATURES_TABLE_OPTIONAL_COL,
                  METRIC_COL
                )}
              >
                {row.metric}
              </TableCell>
              <TableCell
                className={cn("py-3 text-sm tabular-nums", RESULT_COL)}
              >
                <span className="text-muted-foreground">{row.before}</span>
                <span className="text-muted-foreground px-1">→</span>
                <span className="font-semibold text-(--success)">
                  {row.now}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
