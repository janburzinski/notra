"use client";

import { Avatar, AvatarFallback } from "@notra/ui/components/ui/avatar";
import { cn } from "@notra/ui/lib/utils";

import { DomainLogoImage } from "@/components/domain-logo-image";
import type { CompetitorLogoProps } from "@/types/geo";

export function CompetitorLogo({
  name,
  domain,
  className,
  onSettled,
}: CompetitorLogoProps) {
  return (
    <Avatar
      className={cn(
        "bg-muted size-5 shrink-0 overflow-hidden rounded-sm after:hidden",
        className
      )}
    >
      <DomainLogoImage
        alt={`${name} logo`}
        className="size-full object-contain"
        domain={domain}
        fallback={
          <AvatarFallback
            aria-hidden="true"
            className="bg-muted text-[0.625rem] leading-none"
          >
            {name.trim().charAt(0).toUpperCase()}
          </AvatarFallback>
        }
        onSettled={onSettled}
      />
    </Avatar>
  );
}
