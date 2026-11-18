import { Badge } from "@notra/ui/components/ui/badge";

import { MockFrame } from "@/components/landing/mock-frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/marketing-table";
import { AUTOPILOT_DRAFTS_CARD } from "@/constants/feature-pages/autopilot";

const HEADER_CLASS = "text-muted-foreground text-xs";
const STATUS_COL = "w-28";

export function AutopilotCardDrafts() {
  const { frame, headers, rows, statuses } = AUTOPILOT_DRAFTS_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className={HEADER_CLASS}>
              {headers.pullRequest}
            </TableHead>
            <TableHead className={`${HEADER_CLASS} ${STATUS_COL}`}>
              {headers.status}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.number}>
              <TableCell className="min-w-0 py-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {row.title}
                  </span>
                  <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-xs">
                    <span className="shrink-0">{row.number}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{row.branch}</span>
                  </span>
                </span>
              </TableCell>
              <TableCell className={`py-3 ${STATUS_COL}`}>
                <Badge
                  shape="rounded"
                  size="md"
                  variant={row.status === "merged" ? "success" : "secondary"}
                >
                  {statuses[row.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MockFrame>
  );
}
