"use client";

import { Avatar, AvatarFallback } from "@notra/ui/components/ui/avatar";

import { DomainLogoImage } from "@/components/domain-logo-image";
import type { StoreIntegrationLogoProps } from "@/types/integrations/mcp";

export function StoreIntegrationLogo({
  integration,
}: StoreIntegrationLogoProps) {
  const lightLogo = integration.logoLightUrl ?? integration.logoDarkUrl;
  const darkLogo = integration.logoDarkUrl ?? integration.logoLightUrl;
  const domain = integration.websiteUrl ?? integration.url;
  const fallback = integration.name.trim().slice(0, 2).toUpperCase() || "?";

  return (
    <>
      <Avatar className="size-6 rounded after:hidden dark:hidden" size="sm">
        <DomainLogoImage
          alt={`${integration.name} logo`}
          className="rounded object-contain"
          domain={domain}
          fallback={
            <AvatarFallback className="rounded text-xs font-medium">
              {fallback}
            </AvatarFallback>
          }
          preferredSources={[lightLogo, darkLogo]}
        />
      </Avatar>
      <Avatar
        className="hidden size-6 rounded after:hidden dark:flex"
        size="sm"
      >
        <DomainLogoImage
          alt={`${integration.name} logo`}
          className="rounded object-contain"
          domain={domain}
          fallback={
            <AvatarFallback className="rounded text-xs font-medium">
              {fallback}
            </AvatarFallback>
          }
          preferredSources={[darkLogo, lightLogo]}
        />
      </Avatar>
    </>
  );
}
