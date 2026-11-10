import {
  Globe02Icon,
  Link04Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { EngineIcon } from "@/components/geo/engine-icon";
import { WebOutboundFavicon } from "@/components/geo/web-outbound-favicon";
import {
  WEB_REFERRER_LOGOS,
  WEB_SOURCE_DOMAINS,
  WEB_SOURCE_HOST_PATTERN,
} from "@/constants/web-analytics";
import type { WebReferrerIconProps } from "@/types/geo";

export function WebReferrerIcon({ source }: WebReferrerIconProps) {
  if (source.group === "ai") {
    return <EngineIcon className="size-3.5 shrink-0" engine={source.source} />;
  }
  if (source.group === "direct") {
    return (
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground size-3.5 shrink-0"
        icon={Link04Icon}
      />
    );
  }
  const Logo = Object.hasOwn(WEB_REFERRER_LOGOS, source.source)
    ? WEB_REFERRER_LOGOS[source.source]
    : undefined;
  if (Logo) {
    return <Logo aria-hidden="true" className="size-3.5 shrink-0" />;
  }
  const fallbackIcon = source.group === "search" ? Search01Icon : Globe02Icon;
  let domain: string | undefined;
  if (Object.hasOwn(WEB_SOURCE_DOMAINS, source.source)) {
    domain = WEB_SOURCE_DOMAINS[source.source];
  } else if (WEB_SOURCE_HOST_PATTERN.test(source.source)) {
    domain = source.source;
  }
  if (domain) {
    return <WebOutboundFavicon fallbackIcon={fallbackIcon} url={domain} />;
  }
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className="text-muted-foreground size-3.5 shrink-0"
      icon={fallbackIcon}
    />
  );
}
