"use client";

import { useEffect, useRef, useState } from "react";

import {
  TRAFFIC_EMBED_POLL_INTERVAL_MS,
  TRAFFIC_EMBED_POLL_MAX_BACKOFF_MS,
  TRAFFIC_EMBED_RELOAD_MIN_INTERVAL_MS,
  TRAFFIC_EMBED_RELOAD_STORAGE_KEY,
} from "@/constants/traffic-embed";
import type { PublicTrafficEmbed } from "@/types/traffic-embed";
import {
  trafficEmbedDataUrl,
  trafficEmbedOriginAllowed,
} from "@/utils/traffic-embed";

/** ±10%, so displays opened together don't poll in lockstep. */
function jittered(ms: number): number {
  return ms * (0.9 + Math.random() * 0.2);
}

/**
 * Reloads at most once per window, so a value that keeps flipping (say,
 * two deploys answering in turn) can't loop the page. Returns the ms left
 * until a reload is allowed, or 0 when it reloads now.
 */
function reloadOnce(): number {
  const now = Date.now();
  try {
    const last = Number(
      window.sessionStorage.getItem(TRAFFIC_EMBED_RELOAD_STORAGE_KEY)
    );
    const wait = last + TRAFFIC_EMBED_RELOAD_MIN_INTERVAL_MS - now;
    if (wait > 0) {
      return wait;
    }
    window.sessionStorage.setItem(
      TRAFFIC_EMBED_RELOAD_STORAGE_KEY,
      String(now)
    );
  } catch {
    // Without storage the min interval can't be kept; reload anyway, since
    // the page would otherwise keep old code or old frame-ancestors.
  }
  window.location.reload();
  return 0;
}

/**
 * Whether the site around the frame is still allowed. Unknown parents
 * pass; frame-ancestors decides on the next load.
 */
function parentAllowed(allowedOrigins: readonly string[]): boolean {
  let parent: string | null = window.location.ancestorOrigins?.[0] ?? null;
  if (!parent && document.referrer) {
    try {
      parent = new URL(document.referrer).origin;
    } catch {
      parent = null;
    }
  }
  return (
    !parent ||
    parent === window.location.origin ||
    trafficEmbedOriginAllowed(parent, allowedOrigins)
  );
}

/**
 * Keeps an embed's numbers current for as long as the page stays open, for
 * wall displays that run for days.
 *
 * - Polls every 30 s while the page is visible, and right away when it
 *   becomes visible again or the network comes back.
 * - Sends the last ETag; an unchanged payload is a bodiless 304.
 * - Keeps the previous `data` object when only the timestamp moved, so the
 *   charts don't redraw for nothing.
 * - Failed polls back off and keep the last numbers on screen.
 * - A deleted embed (404) or a refused request (403) clears the page, like
 *   a fresh load would.
 * - A new deploy or changed chart or domain list (a new `revision`) reloads
 *   the page, so code and frame-ancestors match the server again. When the
 *   last reload was too recent, the new charts show now and the reload
 *   follows once allowed; a parent site that was removed goes blank now.
 */
export function useLiveTrafficEmbed(
  embedId: string,
  initial: PublicTrafficEmbed,
  search: { range?: string; charts?: string }
): PublicTrafficEmbed | null {
  const [embed, setEmbed] = useState<PublicTrafficEmbed | null>(initial);
  const revision = useRef(initial.revision);
  // Serialized once on mount, not on every render.
  const [initialJson] = useState(() => JSON.stringify(initial.data));
  const dataJson = useRef(initialJson);
  const { range, charts } = search;

  useEffect(() => {
    const url = trafficEmbedDataUrl(embedId, { range, charts });
    let etag: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let lastPoll = Date.now();
    let stopped = false;
    let controller: AbortController | null = null;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      const delay =
        failures === 0
          ? TRAFFIC_EMBED_POLL_INTERVAL_MS
          : Math.min(
              TRAFFIC_EMBED_POLL_INTERVAL_MS * 2 ** failures,
              TRAFFIC_EMBED_POLL_MAX_BACKOFF_MS
            );
      timer = setTimeout(poll, jittered(delay));
    };

    // Frames on one page share the sessionStorage timestamp, so another
    // frame's reload can move the window again; keep waiting until this
    // frame gets its turn. True when it reloads now.
    const reloadWhenAllowed = (): boolean => {
      const wait = reloadOnce();
      if (wait > 0) {
        reloadTimer = setTimeout(reloadWhenAllowed, wait);
      }
      return wait === 0;
    };

    const apply = (next: PublicTrafficEmbed) => {
      if (!parentAllowed(next.allowedOrigins)) {
        setEmbed(null);
        return;
      }
      if (next.revision !== revision.current) {
        clearTimeout(reloadTimer);
        if (reloadWhenAllowed()) {
          return;
        }
        revision.current = next.revision;
      }
      const nextJson = JSON.stringify(next.data);
      const sameData = nextJson === dataJson.current;
      dataJson.current = nextJson;
      setEmbed((previous) =>
        sameData && previous ? { ...next, data: previous.data } : next
      );
    };

    async function poll() {
      if (stopped) {
        return;
      }
      if (document.visibilityState === "hidden") {
        // Checked again when the page shows; nothing is drawn meanwhile.
        return;
      }
      lastPoll = Date.now();
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(url, {
          cache: "no-cache",
          headers: etag ? { "If-None-Match": etag } : {},
          signal: controller.signal,
        });
        if (response.status === 404 || response.status === 403) {
          setEmbed(null);
          failures = 0;
        } else if (response.status === 304) {
          failures = 0;
        } else if (response.ok) {
          etag = response.headers.get("ETag");
          apply((await response.json()) as PublicTrafficEmbed);
          failures = 0;
        } else {
          failures += 1;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        failures += 1;
      }
      schedule();
    }

    const resume = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (Date.now() - lastPoll >= TRAFFIC_EMBED_POLL_INTERVAL_MS) {
        failures = 0;
        void poll();
      } else {
        schedule();
      }
    };
    const online = () => {
      failures = 0;
      void poll();
    };

    timer = setTimeout(poll, jittered(TRAFFIC_EMBED_POLL_INTERVAL_MS));
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", online);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(reloadTimer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", online);
    };
  }, [embedId, range, charts]);

  return embed;
}
