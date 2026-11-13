"use client";

import { HugeiconsIcon } from "@hugeicons/react";

import type { AutopilotSettingsRowProps } from "@/types/autopilot";

/** One line of the Autopilot settings card: icon, label and its control. */
export function AutopilotSettingsRow({
  icon,
  label,
  description,
  htmlFor,
  children,
}: AutopilotSettingsRowProps) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0"
        icon={icon}
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1">
        <label className="text-sm font-medium" htmlFor={htmlFor}>
          {label}
        </label>
        {description ? (
          <p className="text-muted-foreground text-xs text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}
