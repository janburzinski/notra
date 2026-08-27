"use client";

import { CpuIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback } from "@notra/ui/components/ui/avatar";
import { cn } from "@notra/ui/lib/utils";

import { DomainLogoImage } from "@/components/domain-logo-image";
import type { McpIconProps } from "@/types/integrations/mcp";

export function McpIcon({
  darkUrl,
  lightUrl,
  serverUrl,
  className,
}: McpIconProps) {
  return (
    <span className={cn("relative size-4 shrink-0", className)}>
      <Avatar className="size-full rounded-sm after:hidden dark:hidden">
        <DomainLogoImage
          className="rounded-sm object-contain"
          domain={serverUrl}
          fallback={
            <AvatarFallback className="rounded-sm bg-transparent">
              <HugeiconsIcon className="size-[75%]" icon={CpuIcon} />
            </AvatarFallback>
          }
          preferredSources={[lightUrl, darkUrl]}
        />
      </Avatar>
      <Avatar className="hidden size-full rounded-sm after:hidden dark:flex">
        <DomainLogoImage
          className="rounded-sm object-contain"
          domain={serverUrl}
          fallback={
            <AvatarFallback className="rounded-sm bg-transparent">
              <HugeiconsIcon className="size-[75%]" icon={CpuIcon} />
            </AvatarFallback>
          }
          preferredSources={[darkUrl, lightUrl]}
        />
      </Avatar>
    </span>
  );
}
