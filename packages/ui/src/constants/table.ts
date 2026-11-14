/**
 * Chrome shared by the plain `Table` primitive, Markdown tables and the
 * pagination footer. The DataTable itself lives in the `apps/ui` registry
 * (`ui/table`), which owns its own copy of these classes.
 */

/** Grey shell around every table: 1px outer border plus a 2px rim on all sides. */
export const TABLE_FRAME_CLASS =
  "rounded-2xl border border-table-shell-border bg-table-shell p-0.5";

/** The lifted white card inside the shell that holds the rows. */
export const TABLE_BODY_CLASS =
  "rounded-[14px] border border-table-card-border bg-table-card shadow-table-card";

/**
 * Dualtone chrome for a single `<table>`: the header sits on the grey shell,
 * the body cells form the lifted white card. `border-separate` is required
 * because row borders and radii only render on cells in that model.
 */
export const TABLE_CARD_CELLS_CLASS = [
  "[&>tbody>tr>td]:bg-table-card [&>tbody>tr>td]:border-table-row-border [&>tbody>tr>td]:border-b [&>tbody>tr>td]:transition-colors",
  "[&>tbody>tr:hover>td]:bg-muted",
  "[&>tbody>tr:first-child>td]:border-t-table-card-border [&>tbody>tr:first-child>td]:border-t",
  "[&>tbody>tr:first-child>td]:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)]",
  "[&>tbody>tr:last-child>td]:border-b-table-card-border",
  "[&>tbody>tr>td:first-child]:border-l-table-card-border [&>tbody>tr>td:first-child]:border-l",
  "[&>tbody>tr>td:last-child]:border-r-table-card-border [&>tbody>tr>td:last-child]:border-r",
  "[&>tbody>tr:first-child>td:first-child]:rounded-tl-[14px] [&>tbody>tr:first-child>td:last-child]:rounded-tr-[14px]",
  "[&>tbody>tr:last-child>td:first-child]:rounded-bl-[14px] [&>tbody>tr:last-child>td:last-child]:rounded-br-[14px]",
].join(" ");

/** Radius of the white card, so header/footer bands can match it. */
export const TABLE_INNER_RADIUS_CLASS = "rounded-[14px]";

/** Page sizes the table footer offers by default. */
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;
