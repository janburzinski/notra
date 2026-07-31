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
import { useId } from "react";

export function GroupsPageSkeleton() {
  const id = useId();
  return (
    <div className="overflow-hidden rounded-lg border border-border/80 border-b-border/40 bg-muted/80 shadow-2xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[260px]">
              <Skeleton className="h-3.5 w-12" />
            </TableHead>
            <TableHead className="w-[160px]">
              <Skeleton className="h-3.5 w-12" />
            </TableHead>
            <TableHead className="w-[150px]">
              <Skeleton className="h-3.5 w-14" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <TableRow key={`${id}-row-${row}`}>
              <TableCell className="py-3">
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
