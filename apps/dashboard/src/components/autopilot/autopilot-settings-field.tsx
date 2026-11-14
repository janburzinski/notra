import type { ReactNode } from "react";

import type { AutopilotSettingsFieldProps } from "@/types/autopilot";

/** One setting inside an open row: text on the left, its control on the right. */
export function AutopilotSettingsField({
  label,
  htmlFor,
  description,
  children,
}: AutopilotSettingsFieldProps) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1 space-y-0.5">
        {htmlFor ? (
          <label className="block text-sm font-medium" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium">{label}</p>
        )}
        {description ? (
          <p className="text-muted-foreground max-w-xl text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

export function AutopilotSettingsFields({ children }: { children: ReactNode }) {
  return <div className="divide-y">{children}</div>;
}
