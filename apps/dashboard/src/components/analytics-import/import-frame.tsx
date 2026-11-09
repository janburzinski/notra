import { useId } from "react";

import type { ImportFrameProps } from "@/types/components/analytics-import";

/** Dualtone like tables: the label sits on the shell, the rows on the card. */
export function ImportFrame({
  title,
  icon,
  action,
  footer,
  children,
  ...props
}: ImportFrameProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-2"
      {...props}
    >
      <div className="border-shell-border bg-shell rounded-2xl border p-0.5 pt-0">
        <header className="flex min-h-8 items-center justify-between gap-3 ps-2.5 pe-1">
          <h3
            className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs font-medium"
            id={titleId}
          >
            {icon}
            <span className="truncate">{title}</span>
          </h3>
          {action}
        </header>
        <div className="border-table-card-border bg-table-card shadow-table-card overflow-hidden rounded-[14px] border">
          {children}
        </div>
      </div>
      {footer ? (
        <div className="text-muted-foreground px-1 text-xs text-pretty">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
