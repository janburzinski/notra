"use client";

import { cn } from "@notra/ui/lib/utils";
import { googleFaviconUrl } from "@notra/utils/google-favicon";
import { type ComponentProps, useState } from "react";

import { isPublicSearchDomain } from "@/utils/chat-search-activity";

function externalHost(href: string | undefined): string | null {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.hostname
      : null;
  } catch {
    return null;
  }
}

/** The site's icon in front of a link; gone when the site has none. */
function LinkFavicon({ host }: { host: string }) {
  const [failed, setFailed] = useState(false);
  const src = isPublicSearchDomain(host) ? googleFaviconUrl(host, 32) : null;
  if (failed || !src) {
    return null;
  }
  return (
    // biome-ignore lint/performance/noImgElement: a 14px favicon from Google needs no image pipeline.
    <img
      alt=""
      className="mr-1 inline-block size-3.5 rounded-[3px] align-[-2px]"
      decoding="async"
      height={14}
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
      width={14}
    />
  );
}

/** A link in a chat message, with the site's favicon in front of it. */
export function ChatMessageLink({
  children,
  className,
  href,
  node: _node,
  rel,
  target,
  ...props
}: ComponentProps<"a"> & { node?: unknown }) {
  const host = externalHost(href);
  return (
    <a
      className={cn(
        "text-foreground hover:text-foreground/80 font-medium underline underline-offset-3 transition-colors",
        className
      )}
      href={href}
      rel={rel ?? (host ? "noopener noreferrer" : undefined)}
      target={target ?? (host ? "_blank" : undefined)}
      {...props}
    >
      {host ? <LinkFavicon host={host} /> : null}
      {children}
    </a>
  );
}
