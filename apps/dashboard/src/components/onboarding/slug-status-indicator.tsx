"use client";

import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useTranslations } from "use-intl";

import type { SlugStatusIndicatorProps } from "@/types/onboarding";

export function SlugStatusIndicator({ status }: SlugStatusIndicatorProps) {
  const t = useTranslations("onboarding.workspace");
  return (
    <span
      aria-hidden={!status}
      aria-label={status ? t(`slugStatus.${status}`) : undefined}
      className="pointer-events-none absolute right-3.5 flex size-6 items-center justify-center"
      role="status"
    >
      <span
        className={`text-muted-foreground duration-fast absolute transition-opacity motion-reduce:transition-none ${status === "checking" ? "opacity-100" : "opacity-0"}`}
      >
        <Spinner />
      </span>
      <span
        className={`bg-success/15 text-success duration-fast absolute flex size-6 items-center justify-center rounded-full transition-[opacity,transform] motion-reduce:transition-none ${status === "available" ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
      >
        <HugeiconsIcon className="size-4" icon={Tick02Icon} strokeWidth={2} />
      </span>
      <span
        className={`bg-destructive/10 text-destructive duration-fast absolute flex size-6 items-center justify-center rounded-full transition-[opacity,transform] motion-reduce:transition-none ${status === "unavailable" ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
      >
        <HugeiconsIcon className="size-4" icon={Cancel01Icon} strokeWidth={2} />
      </span>
      <HugeiconsIcon
        className={`text-muted-foreground duration-fast absolute size-4 transition-opacity motion-reduce:transition-none ${status === "error" ? "opacity-100" : "opacity-0"}`}
        icon={Cancel01Icon}
        strokeWidth={2}
      />
    </span>
  );
}
