"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import type { DataTableProps } from "@/types/logs/data-table";

export function DataTable<TData>({
  columns,
  data,
  page,
  totalPages,
  onPageChange,
  isLoading,
  emptyState,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualPagination: true,
    state: {
      sorting,
    },
  });

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border/80 border-b-border/40 bg-muted/80 shadow-2xs">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading &&
              [1, 2, 3].map((row) => (
                <TableRow key={row}>
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableCell key={`${row}-${column.id}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading &&
              table.getRowModel().rows?.length > 0 &&
              table.getRowModel().rows.map((row) => (
                <TableRow
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!(isLoading || table.getRowModel().rows?.length) && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState
                    actionLabel={
                      emptyState?.onActionClick
                        ? emptyState.actionLabel
                        : undefined
                    }
                    actionVariant="outline"
                    description={emptyState?.description}
                    onActionClick={emptyState?.onActionClick}
                    title={emptyState?.title ?? "No results."}
                    variant="table"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {(totalPages > 1 || data.length > 0) && (
        <div className="flex items-center justify-between py-4">
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center space-x-2">
            <Button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
