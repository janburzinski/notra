"use client";

import { Avatar, AvatarImage } from "@notra/ui/components/ui/avatar";
import { cn } from "@notra/ui/lib/utils";

import { DomainLogoImage } from "@/components/domain-logo-image";
import { GEO_AVATAR_FALLBACK_BASE } from "@/constants/geo";
import type { GeoProjectLogoProps } from "@/types/geo";

export function ProjectLogo({
  name,
  domain,
  className,
  fallbackClassName,
}: GeoProjectLogoProps) {
  const fallback = `${GEO_AVATAR_FALLBACK_BASE}?seed=${encodeURIComponent(name.toLowerCase())}`;
  return (
    <Avatar
      className={cn(
        "size-4 shrink-0 overflow-hidden rounded-sm after:hidden",
        className
      )}
    >
      <DomainLogoImage
        alt={`${name} logo`}
        className="size-full object-contain"
        domain={domain}
        fallback={
          <AvatarImage
            alt={`${name} logo`}
            className={cn("size-full object-contain", fallbackClassName)}
            src={fallback}
          />
        }
      />
    </Avatar>
  );
}
