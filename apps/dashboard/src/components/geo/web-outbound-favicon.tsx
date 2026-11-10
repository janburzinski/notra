"use client";

import { Link04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { googleFaviconUrl } from "@notra/utils/google-favicon";
import { useState } from "react";

import Image from "@/components/framework/image";
import { WEB_OUTBOUND_FAVICON_SIZE } from "@/constants/web-analytics";
import type { WebOutboundFaviconProps } from "@/types/geo";

/** Favicon of a link's site, or a fallback icon if it has none. */
export function WebOutboundFavicon({
  url,
  fallbackIcon = Link04Icon,
}: WebOutboundFaviconProps) {
  const [failed, setFailed] = useState(false);
  const src = googleFaviconUrl(
    url.split("/")[0] ?? "",
    WEB_OUTBOUND_FAVICON_SIZE
  );
  if (!src || failed) {
    return (
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground size-3.5 shrink-0"
        icon={fallbackIcon}
      />
    );
  }
  return (
    <Image
      alt=""
      className="size-3.5 shrink-0 rounded-sm object-contain"
      height={WEB_OUTBOUND_FAVICON_SIZE}
      onError={() => setFailed(true)}
      src={src}
      unoptimized
      width={WEB_OUTBOUND_FAVICON_SIZE}
    />
  );
}
