import { existsSync } from "node:fs";

import { type Browser, chromium } from "playwright-core";

export const SITE_HOST = "site.test";
/** A real hostname that merely starts with "localhost", not a local one. */
export const LOCALHOST_LOOKALIKE_HOST = "localhost-staging.test";
/** Headless Chromium says "HeadlessChrome", which trackers rightly skip. */
export const DESKTOP_CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export function hasChromium(): boolean {
  return existsSync(chromium.executablePath());
}

/**
 * Real Chromium with `site.test` mapped to loopback, so the page is not a
 * localhost page (the tracker skips those) and `navigator.webdriver` stays
 * false the way it is for a person's browser.
 */
export function launchChromium(): Promise<Browser> {
  return chromium.launch({
    args: [
      `--host-resolver-rules=MAP ${SITE_HOST} 127.0.0.1, MAP ${LOCALHOST_LOOKALIKE_HOST} 127.0.0.1`,
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

export interface CollectedRequest {
  path: string;
  method: string;
  contentType: string;
  origin: string;
  body: Record<string, unknown> | null;
}

/** A page server for `site.test` and a separate-origin collector. */
export function startServers(script: string, pages: Record<string, string>) {
  const collected: CollectedRequest[] = [];
  const collector = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname === "/js/notra.js") {
        return new Response(script, {
          headers: { "Content-Type": "text/javascript" },
        });
      }
      const text = request.method === "POST" ? await request.text() : "";
      collected.push({
        path: new URL(request.url).pathname,
        method: request.method,
        contentType: request.headers.get("content-type") ?? "",
        origin: request.headers.get("origin") ?? "",
        body: text ? JSON.parse(text) : null,
      });
      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    },
  });
  const collectorOrigin = `http://127.0.0.1:${collector.port}`;
  const endpoint = `${collectorOrigin}/api/collect`;
  const site = Bun.serve({
    port: 0,
    fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/notra.js") {
        return new Response(script, {
          headers: { "Content-Type": "text/javascript" },
        });
      }
      const html = pages[pathname] ?? pages["*"];
      if (!html) {
        return new Response("Not found", { status: 404 });
      }
      const body = html
        .replaceAll("{{endpoint}}", endpoint)
        .replaceAll("{{collector}}", collectorOrigin);
      return new Response(body, {
        headers: { "Content-Type": "text/html" },
      });
    },
  });
  return {
    collected,
    origin: `http://${SITE_HOST}:${site.port}`,
    stop() {
      site.stop(true);
      collector.stop(true);
    },
  };
}

export async function waitFor(check: () => boolean, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for condition");
    }
    await Bun.sleep(20);
  }
}
