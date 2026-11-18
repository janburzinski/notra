import { RankBadge } from "@/components/feature-pages/rank-badge";
import { TableCard } from "@/components/feature-pages/table-card";
import { TableCell, TableHead, TableRow } from "@/components/marketing-table";
import { FREE_SCAN_ROWS } from "@/constants/feature-pages/free-scan";
import { FEATURE_TABLE_ROW_CLASS } from "@/constants/feature-pages/tables";
import { DUAL_TONE_TABLE_HEADER_CELL_CLASS } from "@/constants/landing/dual-tone-table";

export function FreeScanTable() {
  return (
    <TableCard
      columns={
        <colgroup>
          <col className="w-[58%]" />
          <col className="w-[16%]" />
          <col />
        </colgroup>
      }
      head={
        <>
          <TableHead className={DUAL_TONE_TABLE_HEADER_CELL_CLASS}>
            Prompt
          </TableHead>
          <TableHead className={DUAL_TONE_TABLE_HEADER_CELL_CLASS}>
            Your rank
          </TableHead>
          <TableHead className={DUAL_TONE_TABLE_HEADER_CELL_CLASS}>
            Named first
          </TableHead>
        </>
      }
      meta="ChatGPT · 15 of 30 answers"
      minWidthClass="min-w-140"
      title="Free scan results"
    >
      {FREE_SCAN_ROWS.map((row) => (
        <TableRow className={FEATURE_TABLE_ROW_CLASS} key={row.prompt}>
          <TableCell className="py-3 text-[0.9375rem] whitespace-normal">
            {row.prompt}
          </TableCell>
          <TableCell className="py-3">
            <RankBadge rank={row.rank} />
          </TableCell>
          <TableCell className="text-muted-foreground py-3 text-sm">
            {row.leader}
          </TableCell>
        </TableRow>
      ))}
    </TableCard>
  );
}
