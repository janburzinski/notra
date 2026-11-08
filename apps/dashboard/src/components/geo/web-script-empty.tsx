"use client";

import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";

import type { WebScriptEmptyProps } from "@/types/geo";

/** Empty state for a notra.js report that also says how to start filling it. */
export function WebScriptEmpty({ title, description }: WebScriptEmptyProps) {
  return (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Analytics01Icon}
            strokeWidth={1.5}
          />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
