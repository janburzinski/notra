import type { CSSProperties } from "react";

import type { DataTableLabels } from "../types/data-table";

export const TABLE_FRAME_CLASS =
  "rounded-2xl border border-shell-border bg-shell p-0.5";

export const TABLE_BODY_CLASS =
  "rounded-[14px] border border-border bg-background shadow-lift";

export const TABLE_CARD_CELLS_CLASS = [
  "[&>tbody>tr>td]:bg-background [&>tbody>tr>td]:border-border/60 [&>tbody>tr>td]:border-b [&>tbody>tr>td]:transition-colors",
  "[&>tbody>tr:hover>td]:bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))]",
  "[&>tbody>tr:first-child>td]:border-t-border [&>tbody>tr:first-child>td]:border-t",
  "[&>tbody>tr:last-child>td]:border-b-border",
  "[&>tbody>tr>td:first-child]:border-l-border [&>tbody>tr>td:first-child]:border-l",
  "[&>tbody>tr>td:last-child]:border-r-border [&>tbody>tr>td:last-child]:border-r",
  "[&>tbody>tr:first-child>td:first-child]:rounded-tl-[14px] [&>tbody>tr:first-child>td:last-child]:rounded-tr-[14px]",
  "[&>tbody>tr:last-child>td:first-child]:rounded-bl-[14px] [&>tbody>tr:last-child>td:last-child]:rounded-br-[14px]",
].join(" ");

export const TABLE_INNER_RADIUS_CLASS = "rounded-[14px]";

export const TABLE_ROW_BORDER_CLASS = "border-border/60 border-b";

export const TABLE_CELL_INNER_CLASS =
  "w-full min-w-0 truncate [&>*]:min-w-0 [&>*]:max-w-full";

export const CHECKBOX_COLUMN_WIDTH = "3rem";

export const TABLE_FRAME_INSET = "8px";

export const HEADER_PAD_X_PX = 32;
export const SORT_ICON_PX = 18;
export const HINT_ICON_PX = 18;
export const DEFAULT_MIN_COLUMN_WIDTH = 64;
export const HEADER_CH_BUFFER = 1;

export const DATA_TABLE_ROW_HEIGHT = 48;
export const DATA_TABLE_HEIGHT = 440;
export const DATA_TABLE_OVERSCAN = 10;
export const DATA_TABLE_SKELETON_ROWS = 3;
export const INFINITE_TABLE_END_THRESHOLD_ROWS = 4;

export const TABLE_SKELETON_COLUMN_WIDTHS = ["1fr", "1fr", "8rem", "6rem"];
export const TABLE_SKELETON_ROW_COUNT = 5;
export const TABLE_SKELETON_ROW_HEIGHT = 52;

export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

export const DATA_TABLE_LABELS: DataTableLabels = {
  table: "Table",
  noData: "No data",
  selectAllRows: "Select all rows",
  selectRow: (row) => `Select row ${row}`,
  resizeColumn: (column) => `Resize ${column} column`,
  pagination: "Pagination",
  goToPreviousPage: "Go to previous page",
  goToNextPage: "Go to next page",
  paginationRange: (start, end, total) => `${start}-${end} of ${total}`,
  paginationRangeOpen: (start, end) => `${start}-${end}`,
  pageOf: (page, total) => `Page ${page} of ${total}`,
  pageNumber: (page) => `Page ${page}`,
  showRows: (count) => `Show ${count}`,
  rowsPerPage: "Rows per page",
};

export const HORIZONTAL_OVERFLOW_TOLERANCE_PX = 2;

export const TABLE_BODY_RADIUS_PX = 14;
export const CORNER_SCROLLBAR_GAP_PX = 3;
export const CORNER_SCROLLBAR_WIDTH_PX = 4;
export const TABLE_SHELL_INSET_PX = 3;
export const CORNER_SCROLLBAR_MIN_THUMB_PX = 28;
export const CORNER_SCROLLBAR_IDLE_MS = 900;

export const CORNER_SCROLLBAR_VARS = {
  "--corner-scrollbar-gap": `${CORNER_SCROLLBAR_GAP_PX}px`,
  "--corner-scrollbar-width": `${CORNER_SCROLLBAR_WIDTH_PX}px`,
  "--corner-card-radius": `${CORNER_SCROLLBAR_GAP_PX + CORNER_SCROLLBAR_WIDTH_PX / 2}px`,
  "--corner-shell-radius": `${CORNER_SCROLLBAR_GAP_PX + CORNER_SCROLLBAR_WIDTH_PX / 2 + TABLE_SHELL_INSET_PX}px`,
} as CSSProperties;
