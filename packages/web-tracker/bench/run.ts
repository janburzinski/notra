import { mkdir } from "node:fs/promises";
import { brotliCompressSync, gzipSync } from "node:zlib";

import type { Browser, BrowserContext, Page, Request } from "playwright-core";

import { TRACKER_PLUS_SCRIPT, TRACKER_SCRIPT } from "../src/generated/script";
import {
  DESKTOP_CHROME_USER_AGENT,
  launchChromium,
} from "../tests/utils/browser";
import { renderReport } from "./report";
import { INTERACTION_MARK, scriptTime } from "./trace";
import type { RunSample, TraceEvent, Vendor, VendorResult } from "./types";
import { VENDORS } from "./vendors";

const RUNS = Number(process.env.BENCH_RUNS ?? 8);
const CPU_SLOWDOWN = Number(process.env.BENCH_CPU_SLOWDOWN ?? 4);
const ONLY = process.env.BENCH_ONLY?.split(",");
const PAGE_URL = "https://bench.test/";
const CACHE = new URL(".cache/", import.meta.url).pathname;
const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "v8.execute",
  "blink.user_timing",
];
const SAFELISTED_CONTENT_TYPES = [
  "text/plain",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
];
const BROWSER_HEADERS =
  /^(sec-|user-agent$|referer$|origin$|accept|content-length$|cookie$)/;

const COUNTERS = `
  window.__bench = { intervals: 0, frames: 0, observers: 0, longTasks: 0 };
  const setIntervalNative = window.setInterval;
  window.setInterval = function (...args) { __bench.intervals++; return setIntervalNative.apply(this, args); };
  const rafNative = window.requestAnimationFrame;
  window.requestAnimationFrame = function (callback) { __bench.frames++; return rafNative.call(this, callback); };
  const observeNative = MutationObserver.prototype.observe;
  MutationObserver.prototype.observe = function (...args) { __bench.observers++; return observeNative.apply(this, args); };
  new PerformanceObserver((list) => { __bench.longTasks += list.getEntries().length; }).observe({ type: "longtask", buffered: true });
`;

function page(tag: string): string {
  const paragraphs = Array.from(
    { length: 60 },
    (_, index) =>
      `<h2>Section ${index}</h2><p>${"Analytics should not cost your visitors anything. ".repeat(8)}<a href="/docs/${index}">Read more</a> or <a href="https://example.com/${index}">leave</a>.</p>`
  ).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bench</title>${tag}</head><body><button id="cta">Sign up</button><main>${paragraphs}</main></body></html>`;
}

async function loadScripts(): Promise<Map<string, string>> {
  await mkdir(`${CACHE}scripts`, { recursive: true });
  const scripts = new Map<string, string>([
    ["notra", TRACKER_SCRIPT],
    ["notra-plus", TRACKER_PLUS_SCRIPT],
  ]);
  for (const vendor of VENDORS) {
    if (!vendor.url || scripts.has(vendor.id)) {
      continue;
    }
    const path = `${CACHE}scripts/${new URL(vendor.url).hostname}.js`;
    const cached = Bun.file(path);
    if (await cached.exists()) {
      scripts.set(vendor.id, await cached.text());
      continue;
    }
    const response = await fetch(vendor.url);
    if (!response.ok) {
      throw new Error(`Could not download ${vendor.url}: ${response.status}`);
    }
    const text = await response.text();
    await Bun.write(path, text);
    scripts.set(vendor.id, text);
  }
  return scripts;
}

function needsPreflight(request: Request): boolean {
  if (new URL(request.url()).origin === new URL(PAGE_URL).origin) {
    return false;
  }
  const method = request.method();
  if (!["GET", "HEAD", "POST"].includes(method)) {
    return true;
  }
  const headers = request.headers();
  const contentType = headers["content-type"]?.split(";")[0]?.trim();
  if (contentType && !SAFELISTED_CONTENT_TYPES.includes(contentType)) {
    return true;
  }
  return Object.keys(headers).some(
    (name) => !(BROWSER_HEADERS.test(name) || name === "content-type")
  );
}

async function measure(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const heap = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number };
  let listeners = 0;
  for (const target of ["window", "document"]) {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: target,
    });
    const found = (await cdp.send("DOMDebugger.getEventListeners", {
      objectId: result.objectId ?? "",
    })) as { listeners: unknown[] };
    listeners += found.listeners.length;
  }
  await cdp.detach();
  return { heapBytes: heap.usedSize, listeners };
}

async function runOnce(
  vendor: Vendor,
  scripts: Map<string, string>,
  browser: Browser
): Promise<RunSample> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: DESKTOP_CHROME_USER_AGENT,
  });
  await context.addInitScript(COUNTERS);
  const beacons: Request[] = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = request.url();
    if (
      url === PAGE_URL ||
      url.startsWith(`${PAGE_URL}?`) ||
      url.startsWith(`${PAGE_URL}docs`)
    ) {
      return route.fulfill({
        contentType: "text/html",
        body: page(vendor.tag),
      });
    }
    if (vendor.url && url === vendor.url) {
      return route.fulfill({
        contentType: "text/javascript",
        body: scripts.get(vendor.id) ?? "",
      });
    }
    beacons.push(request);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "{}",
    });
  });
  const tab = await context.newPage();
  const cdp = await context.newCDPSession(tab);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });

  await browser.startTracing(tab, { categories: TRACE_CATEGORIES });
  await tab.goto(PAGE_URL, { waitUntil: "load" });
  await tab.waitForTimeout(3000);
  const { heapBytes, listeners } = await measure(context, tab);
  await tab.evaluate((mark) => performance.mark(mark), INTERACTION_MARK);
  for (let step = 0; step < 10; step += 1) {
    await tab.mouse.wheel(0, 400);
    await tab.waitForTimeout(50);
  }
  for (let click = 0; click < 3; click += 1) {
    await tab.click("#cta");
  }
  for (const path of ["/docs/1", "/docs/2", "/docs/3"]) {
    await tab.evaluate((next) => history.pushState({}, "", next), path);
    await tab.waitForTimeout(300);
  }
  await tab.waitForTimeout(2600);
  const counters = (await tab.evaluate("window.__bench")) as {
    intervals: number;
    frames: number;
    observers: number;
    longTasks: number;
  };
  await tab.goto("about:blank");
  await tab.waitForTimeout(300);
  const trace = await browser.stopTracing();
  await context.close();

  const events = (JSON.parse(trace.toString()) as { traceEvents: TraceEvent[] })
    .traceEvents;
  const time = vendor.url
    ? scriptTime(events, vendor.url)
    : { loadMs: 0, interactionMs: 0 };
  const sent = beacons.filter(
    (request) => request.resourceType() !== "document"
  );
  return {
    ...time,
    heapBytes,
    listeners,
    intervals: counters.intervals,
    animationFrames: counters.frames,
    mutationObservers: counters.observers,
    longTasks: counters.longTasks,
    requests: sent.length,
    uploadBytes: sent.reduce(
      (total, request) =>
        total + (request.postDataBuffer()?.length ?? 0) + request.url().length,
      0
    ),
    preflights: sent.filter(needsPreflight).length,
  };
}

function sizes(script: string) {
  const bytes = Buffer.from(script);
  return {
    raw: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes).length,
  };
}

const vendors = VENDORS.filter(
  (vendor) => !ONLY || vendor.id === "none" || ONLY.includes(vendor.id)
);
const scripts = await loadScripts();
const browser = await launchChromium();
const results = new Map<string, VendorResult>(
  vendors.map((vendor) => [
    vendor.id,
    { vendor, size: sizes(scripts.get(vendor.id) ?? ""), samples: [] },
  ])
);
// Interleave vendors so drift (thermal, background load) hits all of them.
for (let round = 0; round < RUNS; round += 1) {
  for (const vendor of vendors) {
    results
      .get(vendor.id)
      ?.samples.push(await runOnce(vendor, scripts, browser));
  }
  console.log(`round ${round + 1}/${RUNS} done`);
}
await browser.close();

const output = [...results.values()];
await Bun.write(`${CACHE}results.json`, JSON.stringify(output, null, 2));
const report = renderReport(output, { runs: RUNS, cpuSlowdown: CPU_SLOWDOWN });
await Bun.write(`${CACHE}report.md`, report.markdown);
await Bun.write(`${CACHE}report.html`, report.html);
console.log(report.markdown);
