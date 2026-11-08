import { useId } from "react";

import type { ImportFrameProps } from "@/types/components/analytics-import";

/** A small muted label above a plain bordered box, and an optional note under it. */
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
      <header className="flex min-h-6 items-center justify-between gap-3">
        <h3
          className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs font-medium"
          id={titleId}
        >
          {icon}
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </header>
      <div className="bg-background overflow-hidden rounded-lg border">
        {children}
      </div>
      {footer ? (
        <div className="text-muted-foreground text-xs text-pretty">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
