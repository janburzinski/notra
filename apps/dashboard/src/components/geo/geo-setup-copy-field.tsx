"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import { useTranslations } from "use-intl";

import { cn } from "@/lib/utils";
import type { GeoSetupCopyFieldProps } from "@/types/geo";
import { toastCopyError } from "@/utils/copy-to-clipboard";

export function GeoSetupCopyField({
  display,
  value,
  label,
  onCopy,
  icon,
  mono = true,
  raised = false,
  className,
}: GeoSetupCopyFieldProps) {
  const tCommon = useTranslations("common");
  return (
    <div
      className={cn(
        "flex h-9 min-w-0 items-center gap-2 rounded-lg border ps-3 pe-1",
        raised ? "bg-background" : "bg-muted/40",
        className
      )}
    >
      {icon ? (
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground size-3.5 shrink-0"
          icon={icon}
        />
      ) : null}
      <span
        className={cn("min-w-0 flex-1 truncate text-xs", mono && "font-mono")}
      >
        {display}
      </span>
      <CopyButton
        aria-label={tCommon("labels.copyLabel", { label })}
        className="text-muted-foreground"
        onCopy={onCopy}
        onCopyError={toastCopyError}
        value={value}
      />
    </div>
  );
}
