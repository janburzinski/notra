import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { TableColumn } from "@notra/ui/types/data-table";
import {
  measureColumnFloors,
  tableMinWidthCss,
} from "@notra/ui/lib/data-table";

interface CollapsibleColumnsOptions {
  minColumnWidth: number;
  extraFixedWidths?: readonly string[];
}

function columnSignature<T>(column: TableColumn<T>): string {
  const header = typeof column.header === "string" ? column.header : "";
  return [
    column.key,
    column.width ?? "",
    column.minWidth ?? "",
    header,
    column.sortable ? 1 : 0,
    column.collapsePriority ?? "",
  ].join(":");
}

/**
 * Drops low-priority columns while the container is narrower than the
 * remaining column floors. Floors are CSS lengths (rem, ch, calc), so the
 * candidate sets are measured together with hidden probes; resizing afterwards
 * only compares numbers and re-renders when the hidden set actually changes.
 */
export function useCollapsibleColumns<T>(
  columns: TableColumn<T>[],
  {
    minColumnWidth,
    extraFixedWidths = [],
  }: CollapsibleColumnsOptions
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const signature = columns.map(columnSignature).join("|");
  const chromeSignature = extraFixedWidths.join("|");
  const latest = useRef({ columns, extraFixedWidths });
  useLayoutEffect(() => {
    latest.current = { columns, extraFixedWidths };
  });
  const collapseKeys = columns
    .filter((column) => column.collapsePriority !== undefined)
    .sort(
      (left, right) =>
        (right.collapsePriority ?? 0) - (left.collapsePriority ?? 0)
    )
    .map((column) => column.key)
    .join("|");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const collapseOrder = collapseKeys ? collapseKeys.split("|") : [];
    if (!container || collapseOrder.length === 0) {
      setHiddenCount(0);
      return;
    }
    const {
      columns: current,
      extraFixedWidths: fixed,
    } = latest.current;

    const floorWidths = collapseOrder.map((_, count) => {
      const hidden = new Set(collapseOrder.slice(0, count));
      return tableMinWidthCss(
        current.filter((column) => !hidden.has(column.key)),
        minColumnWidth,
        fixed
      );
    });
    // A hidden container measures nothing; the observer measures it once it
    // shows, since its size then changes.
    let floors: readonly number[] | null = null;
    const update = () => {
      let containerWidth = container.clientWidth;
      if (!floors) {
        const measured = measureColumnFloors(container, floorWidths);
        if (!measured) {
          return;
        }
        floors = measured.floors;
        containerWidth = measured.width;
      }
      const fits = floors.findIndex((floor) => floor <= containerWidth);
      setHiddenCount(fits === -1 ? collapseOrder.length : fits);
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(container);
    return () => observer.disconnect();
  }, [collapseKeys, signature, minColumnWidth, chromeSignature]);

  const visibleColumns = useMemo(() => {
    if (hiddenCount === 0) {
      return columns;
    }
    const hidden = new Set(collapseKeys.split("|").slice(0, hiddenCount));
    return columns.filter((column) => !hidden.has(column.key));
  }, [collapseKeys, columns, hiddenCount]);

  return { containerRef, visibleColumns };
}
