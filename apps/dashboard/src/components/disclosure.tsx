"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";

import { Button } from "@/components/button";
import type { DisclosureProps } from "@/types/components/disclosure";

/** Optional detail behind a quiet chevron button, closed by default. */
export function Disclosure({
  label,
  defaultOpen = false,
  children,
}: DisclosureProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        render={<Button className="-ms-2.5" size="sm" variant="ghost" />}
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="-rotate-90 transition-transform duration-150 in-data-panel-open:rotate-0"
          icon={ArrowDown01Icon}
        />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
