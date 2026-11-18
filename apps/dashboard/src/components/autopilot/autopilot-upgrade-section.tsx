import { useId } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import { cn } from "@/lib/utils";
import type { AutopilotUpgradeSectionProps } from "@/types/autopilot";

/** A framed block on the upgrade page: the heading and footer sit on the grey shell. */
export function AutopilotUpgradeSection({
  heading,
  action,
  footer,
  children,
}: AutopilotUpgradeSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={TABLE_FRAME_CLASS}>
      <div className="flex min-h-9 items-center justify-between gap-3 px-3">
        <h2 className="text-sm font-medium" id={headingId}>
          {heading}
        </h2>
        {action}
      </div>
      <div className={cn(TABLE_BODY_CLASS, "px-4 py-3")}>{children}</div>
      {footer ? (
        <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
