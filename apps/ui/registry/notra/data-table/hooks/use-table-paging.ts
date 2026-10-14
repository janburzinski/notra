import { useState } from "react";

import { pageRows } from "../lib/data-table";
import type { DataTablePagination, TableRow } from "../types/data-table";

export function useTablePaging<T>(
  rows: TableRow<T>[],
  pagination: DataTablePagination | undefined,
  visibleRowCount: number | undefined
) {
  const [clientPageSize, setClientPageSize] = useState<number | null>(null);
  const clientPaging =
    pagination?.mode === undefined || pagination.mode === "client"
      ? pagination
      : undefined;
  const ownsPageSize = Boolean(clientPaging && !clientPaging.onPageSizeChange);
  const effective =
    clientPaging && ownsPageSize && clientPageSize !== null
      ? { ...clientPaging, pageSize: clientPageSize }
      : clientPaging;

  if (!effective) {
    return {
      pagedRows: pageRows(rows, 1, visibleRowCount),
      pagination,
      onClientPageSizeChange: undefined,
    };
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / effective.pageSize));
  const page = Math.min(Math.max(1, effective.page), pageCount);
  return {
    pagedRows: pageRows(rows, page, effective.pageSize),
    pagination: effective,
    onClientPageSizeChange: ownsPageSize ? setClientPageSize : undefined,
  };
}
