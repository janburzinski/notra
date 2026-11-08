import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { Browser, Page } from "playwright-core";

import { TRACKER_PLUS_SCRIPT, TRACKER_SCRIPT } from "../src/generated/script";
import {
  hasChromium,
  launchChromium,
  startServers,
  waitFor,
} from "./utils/browser";

const VIEW_ID = /^[a-z0-9]{16,24}$/;
const TAG = `<script defer src="/notra.js" data-key="nwk.test" data-api="{{endpoint}}"></script>`;
const LONG = `<html><body><div style="height:4000px">long</div>${TAG}</body></html>`;
// The capture listener runs before these inline handlers stop the navigation.
const STOP = `onclick="event.preventDefault()" onauxclick="event.preventDefault()"`;
const CLICKS = `<html><body>
<a id="out" href="https://docs.example.org/start?token=secret#top" ${STOP}><span id="inner">docs</span></a>
<a id="own" href="/pricing?ref=nav" ${STOP}>pricing</a>
<a id="mail" href="mailto:hi@example.org" ${STOP}>mail</a>
${TAG}</body></html>`;
// Text paints (FCP, LCP); a late block shifts it (CLS); a slow handler is
// an interaction (INP).
const VITALS = `<html><body><p id="text">Some text that paints first.</p>
<button id="slow">slow</button><div style="height:2000px"></div>
<script>setTimeout(()=>{const d=document.createElement("div");d.style.height="300px";document.body.prepend(d)},300);
document.getElementById("slow").addEventListener("click",()=>{const t=performance.now();while(performance.now()-t<120){}});</script>
${TAG}</body></html>`;
const ERRORS = `<html><body>${TAG}<script>
addEventListener("load",()=>{
  for(let n=0;n<7;n++){setTimeout(()=>{throw new Error("boom "+n+" user@example.com")},n)}
  setTimeout(()=>Promise.reject(new Error("rejected")),20);
});
</script></body></html>`;
const PAGES = {
  "/": `<html><body><a href="/about">about</a>${TAG}</body></html>`,
  "/clicks": CLICKS,
  "/vitals": VITALS,
  "/errors": ERRORS,
  "/long": LONG,
  "/frame": `<html><body><iframe src="/"></iframe></body></html>`,
  "/derived": `<html><body><script defer src="{{collector}}/js/notra.js" data-key="nwk.test"></script></body></html>`,
  "/no-key": `<html><body><script defer src="/notra.js"></script></body></html>`,
  "/hash": `<html><body>${TAG.replace("<script ", "<script data-hash ")}</body></html>`,
  "/no-referrer": `<html><head><meta name="referrer" content="no-referrer"></head><body>${TAG}</body></html>`,
  "/fetch-throws": `<html><head><script>window.fetch=()=>{throw new TypeError("blocked")}</script></head><body>${TAG}</body></html>`,
  "/fetch-rejects": `<html><head><script>window.fetch=()=>Promise.reject(new TypeError("offline"))</script></head><body>${TAG}</body></html>`,
  "*": `<html><body>${TAG}</body></html>`,
};

const servers = startServers(TRACKER_SCRIPT, PAGES);
const plusServers = startServers(TRACKER_PLUS_SCRIPT, PAGES);
let browser: Browser;

beforeAll(async () => {
  if (hasChromium()) {
    browser = await launchChromium();
  }
});
afterAll(async () => {
  await browser?.close();
  servers.stop();
  plusServers.stop();
});

async function withPage(run: (page: Page) => Promise<void>) {
  const context = await browser.newContext();
  try {
    await run(await context.newPage());
  } finally {
    await context.close();
  }
}

function posts(from = servers) {
  return from.collected.filter((request) => request.method === "POST");
}

function bodies(from = servers) {
  return posts(from).flatMap((request) => (request.body ? [request.body] : []));
}

describe.skipIf(!hasChromium())("notra.js in Chromium", () => {
  test("reports a page view, then engagement with the deepest scroll when the page is left", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.setViewportSize({ width: 800, height: 1000 });
      await page.goto(`${servers.origin}/long?utm_source=x#top`, {
        referer: "https://chatgpt.com/",
      });
      await waitFor(() => posts().length === 1);
      await page.evaluate(() => window.scrollTo(0, 1500));
      // Scroll events fire once per frame; let the deep position be observed.
      await page.waitForTimeout(50);
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(100);
      await page.goto(`${servers.origin}/next`);
      await waitFor(() => posts().length === 3);
    });
    // Beacons from the old and new page can arrive in either order.
    const sent = bodies();
    const [view, next] = sent.filter((body) => "r" in body);
    const engagement = sent.find((body) => "t" in body);
    // Read before toMatchObject, which writes its matchers back into the body.
    const visibleMs = Number(engagement?.t);
    const depth = Number(engagement?.s);
    expect(view).toEqual({
      k: "nwk.test",
      v: expect.stringMatching(VIEW_ID),
      u: `${servers.origin}/long?utm_source=x`,
      h: false,
      r: "https://chatgpt.com/",
    });
    expect(engagement).toMatchObject({
      v: view?.v,
      u: `${servers.origin}/long?utm_source=x`,
      t: expect.any(Number),
    });
    expect(visibleMs).toBeGreaterThanOrEqual(100);
    expect(depth).toBeGreaterThanOrEqual(49);
    expect(depth).toBeLessThanOrEqual(51);
    expect(next?.v).not.toBe(view?.v);
    // Nothing else follows: no second engagement beacon, no timers.
    await Bun.sleep(200);
    expect(posts()).toHaveLength(3);
  });

  test("a no-referrer page still sends its origin and text/plain, never a preflight", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/no-referrer`);
      await waitFor(() => posts().length === 1);
      await page.goto(`${servers.origin}/next`);
      await waitFor(() => posts().length === 3);
    });
    for (const request of posts()) {
      expect(request.origin).toBe(servers.origin);
      expect(request.contentType).toStartWith("text/plain");
    }
    expect(posts()[0]?.body).toMatchObject({
      u: `${servers.origin}/no-referrer`,
      r: "",
    });
    expect(
      servers.collected.some((request) => request.method === "OPTIONS")
    ).toBe(false);
  });

  test("falls back to sendBeacon only when fetch throws, never on a rejection", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/fetch-throws`);
      await waitFor(() => posts().length === 1);
      // A page that unloads sees its delivered keepalive fetch reject, so a
      // rejection must not send the beacon again.
      await page.goto(`${servers.origin}/fetch-rejects`);
      await page.waitForTimeout(200);
    });
    expect(posts().map((request) => request.body?.u)).toEqual([
      `${servers.origin}/fetch-throws`,
      `${servers.origin}/fetch-throws`,
    ]);
    expect(bodies().filter((body) => "t" in body)).toHaveLength(1);
  });

  test("counts SPA navigations, path-changing replaces included, and ignores same-URL pushes, hash changes and query-only replaces", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/`);
      await waitFor(() => posts().length === 1);
      await page.evaluate(() => {
        history.pushState({}, "", "/");
        location.hash = "#section";
        history.replaceState({}, "", "/?filter=1");
        history.pushState({}, "", "/pricing");
        history.replaceState({}, "", "/en");
        history.replaceState({}, "", "/en?sort=new");
      });
      await waitFor(() => bodies().filter((body) => "r" in body).length >= 3);
      await page.waitForTimeout(100);
    });
    const views = bodies().filter((body) => "r" in body);
    expect(views.map((body) => body.u)).toEqual([
      `${servers.origin}/`,
      `${servers.origin}/pricing`,
      `${servers.origin}/en`,
    ]);
    expect(views[1]?.r).toBe(`${servers.origin}/`);
  });

  test("with data-hash, hash routes are views, replaced ones too, and every beacon says so", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/hash#/pricing`);
      await waitFor(() => posts().length === 1);
      await page.evaluate(() => {
        location.hash = "#/signup";
      });
      await waitFor(() => bodies().filter((body) => "r" in body).length >= 2);
      await page.evaluate(() => {
        history.replaceState({}, "", "/hash#/account");
        history.replaceState({}, "", "/hash#/account?tab=2");
      });
      await waitFor(() => bodies().filter((body) => "r" in body).length >= 3);
      await page.waitForTimeout(100);
    });
    const sent = bodies();
    expect(sent.filter((body) => "r" in body).map((body) => body.u)).toEqual([
      `${servers.origin}/hash#/pricing`,
      `${servers.origin}/hash#/signup`,
      `${servers.origin}/hash#/account`,
    ]);
    expect(sent.every((body) => body.h === true)).toBe(true);
  });

  test("stays silent in iframes, on localhost, for automation and without a key, and stores nothing", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/frame`);
      await page.goto(`${servers.origin}/no-key`);
      await page.goto(servers.origin.replace("site.test", "127.0.0.1"));
    });
    await withPage(async (page) => {
      await page.addInitScript(() =>
        Object.defineProperty(navigator, "webdriver", { get: () => true })
      );
      await page.goto(`${servers.origin}/`);
      await page.waitForTimeout(200);
    });
    // Without data-api, beacons go to /api/collect on the script's origin.
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/derived`);
      await waitFor(() => posts().length === 1);
      expect(await page.context().cookies()).toEqual([]);
      expect(
        await page.evaluate(() => localStorage.length + sessionStorage.length)
      ).toBe(0);
      await page.goto(`${servers.origin}/no-key`);
      await page.waitForTimeout(200);
    });
    // The top-level view and its engagement on leaving; nothing else.
    expect(posts().map((request) => request.path)).toEqual([
      "/api/collect",
      "/api/collect",
    ]);
    expect(posts().map((request) => request.body?.u)).toEqual([
      `${servers.origin}/derived`,
      `${servers.origin}/derived`,
    ]);
  });

  test("sends left and middle clicks on links to another host as host and path", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/clicks`);
      await waitFor(() => posts().length === 1);
      await page.click("#inner");
      await page.click("#out");
      await page.click("#out", { button: "middle" });
      await page.click("#out", { button: "right" });
      await page.click("#own");
      await page.click("#mail");
      await waitFor(() => posts().length >= 4);
      await page.waitForTimeout(150);
    });
    const [view] = bodies();
    const clicks = bodies().filter((body) => "o" in body);
    const click = {
      k: "nwk.test",
      v: view?.v,
      u: `${servers.origin}/clicks`,
      h: false,
      o: "docs.example.org/start",
    };
    expect(clicks).toEqual([click, click, click]);
  });

  test("reports web vitals once for the loaded page and resets CLS and INP per SPA view", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.goto(`${servers.origin}/vitals`);
      await waitFor(() => posts().length === 1);
      await page.waitForTimeout(500);
      await page.click("#slow");
      await page.waitForTimeout(100);
      await page.evaluate(() => history.pushState({}, "", "/vitals/next"));
      await waitFor(() => posts().length === 3);
      await page.waitForTimeout(100);
      await page.goto(`${servers.origin}/after`);
      await waitFor(() => posts().length === 5);
    });
    const hides = bodies().filter((body) => "t" in body);
    const hard = hides.find((body) => body.u === `${servers.origin}/vitals`);
    const soft = hides.find(
      (body) => body.u === `${servers.origin}/vitals/next`
    );
    expect(hides).toHaveLength(2);
    // Plain reads: Bun's toMatchObject writes asymmetric matchers back into
    // the object it checks.
    for (const field of ["c", "l", "f"]) {
      expect(hard?.[field]).toBeNumber();
      expect(Number(hard?.[field])).toBeGreaterThan(0);
    }
    expect(Number(hard?.i)).toBeGreaterThanOrEqual(100);
    expect(hard?.b).toBeNumber();
    expect(soft).toMatchObject({ c: 0, i: 0 });
    for (const field of ["l", "f", "b"]) {
      expect(soft).not.toHaveProperty(field);
    }
  });

  test("leaves CLS out where the browser has no layout-shift entries", async () => {
    servers.collected.length = 0;
    await withPage(async (page) => {
      await page.addInitScript(() => {
        // Firefox and Safari expose no LayoutShift interface.
        delete (window as { LayoutShift?: unknown }).LayoutShift;
      });
      await page.goto(`${servers.origin}/vitals`);
      await waitFor(() => posts().length === 1);
      await page.goto(`${servers.origin}/after`);
      await waitFor(() => posts().length === 3);
    });
    const hide = bodies().find((body) => "t" in body);
    expect(hide).toMatchObject({ i: expect.any(Number) });
    expect(hide).not.toHaveProperty("c");
  });

  test("notra.plus.js reports errors from http(s) sources, at most 5 per view, no stack", async () => {
    plusServers.collected.length = 0;
    await withPage(async (page) => {
      await page.addInitScript(() => {
        // An error thrown from an extension's script never leaves the page.
        addEventListener("load", () =>
          dispatchEvent(
            new ErrorEvent("error", {
              message: "from an extension",
              filename: "chrome-extension://abc/content.js",
              lineno: 1,
            })
          )
        );
      });
      await page.goto(`${plusServers.origin}/errors`);
      await waitFor(() => posts(plusServers).length >= 6);
      await page.waitForTimeout(200);
    });
    const errors = bodies(plusServers).filter((body) => "x" in body);
    expect(errors).toHaveLength(5);
    expect(errors[0]).toEqual({
      k: "nwk.test",
      v: expect.stringMatching(VIEW_ID),
      u: `${plusServers.origin}/errors`,
      h: false,
      x: "Uncaught Error: boom 0 user@example.com",
      xs: `${plusServers.origin}/errors`,
      xl: expect.any(Number),
    });
    expect(JSON.stringify(errors)).not.toContain("extension");
  });
});
