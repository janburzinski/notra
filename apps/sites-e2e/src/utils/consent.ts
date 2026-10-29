import assert from "node:assert/strict";

import { SITE_ANALYTICS_EVENT_FILE } from "@notra/sites-core/constants/sites";
import type { BrowserContext, Page } from "playwright";

import type { IngestRequest } from "../types/harness";
import { isEngagement } from "./ingest";

const SEARCH_REFERRER = "https://www.google.com/";
const INSIGHTS_SCRIPT = 'script[src$="/_notra/insights.js"]';

function isViewBeacon(url: string, method: string, body: string | null) {
  return (
    url.endsWith(`/${SITE_ANALYTICS_EVENT_FILE}`) &&
    method === "POST" &&
    body?.includes('"k":"view"') === true
  );
}

// A site with the c15t banner, visited by a browser that accepts and one that
// rejects. Only a stored measurement grant lets the Worker count a request;
// otherwise the page's own script reports the view once the banner grants it,
// with the referrer the landing request carried.
export async function assertConsentVisits(options: {
  page: Page;
  context: BrowserContext;
  origin: string;
  ingest: IngestRequest[];
  settle: () => Promise<void>;
}) {
  const { page, context, origin, ingest, settle } = options;
  const landing = `${origin}/blog/hello-world?utm_source=newsletter`;
  const next = `${origin}/blog`;
  const viewBeacons: string[] = [];
  page.on("request", (request) => {
    if (isViewBeacon(request.url(), request.method(), request.postData())) {
      viewBeacons.push(request.postData() ?? "");
    }
  });
  const views = (from: number) =>
    ingest
      .slice(from)
      .filter((event) => !isEngagement(event))
      .map((event) => [
        event.body.url,
        event.body.visitorConsent,
        event.body.referer,
      ]);

  let from = ingest.length;
  const accepted = page.waitForRequest((request) =>
    isViewBeacon(request.url(), request.method(), request.postData())
  );
  const first = await page.goto(landing, { referer: SEARCH_REFERRER });
  assert.equal(first?.status(), 200);
  assert.match(
    (await first?.text()) ?? "",
    /<script type="text\/plain" data-c15t-category="measurement" src="\/blog\/_notra\/insights\.js" data-endpoint="\/blog\/_notra\/e" data-view defer><\/script>/,
    "a visitor without a stored grant gets the gated view reporter"
  );
  await page
    .getByRole("button", { name: /accept/i })
    .first()
    .click();
  const beacon = await accepted;
  assert.equal((await beacon.response())?.status(), 204);
  assert.ok(
    (await context.cookies(origin)).some((cookie) => cookie.name === "c15t"),
    "c15t stores the choice in a cookie"
  );
  const second = await page.goto(next, { referer: landing });
  assert.equal(second?.status(), 200);
  assert.ok(!((await second?.text()) ?? "").includes(" data-view "));
  await page.waitForSelector(`${INSIGHTS_SCRIPT}[data-c15t-activated="true"]`, {
    state: "attached",
  });
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await settle();
  assert.deepEqual(views(from), [
    [landing, false, SEARCH_REFERRER],
    [landing, true, SEARCH_REFERRER],
    [next, true, landing],
  ]);
  assert.equal(viewBeacons.length, 1, "the granted page is not reported twice");
  assert.ok(
    ingest.slice(from).some((event) => isEngagement(event)),
    "time on page is measured after the grant"
  );

  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  from = ingest.length;
  const beaconsBefore = viewBeacons.length;
  await page.goto(landing, { referer: SEARCH_REFERRER });
  await page
    .getByRole("button", { name: /reject/i })
    .first()
    .click();
  await page.waitForFunction(() => document.cookie.includes("c15t="));
  await page.goto(next, { referer: landing });
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await settle();
  assert.deepEqual(views(from), [
    [landing, false, SEARCH_REFERRER],
    [next, false, landing],
  ]);
  assert.equal(viewBeacons.length, beaconsBefore, "a rejection sends no view");
  assert.equal(
    ingest.slice(from).filter((event) => isEngagement(event)).length,
    0,
    "a rejection measures no time on page"
  );
  assert.equal(
    await page.locator(`${INSIGHTS_SCRIPT}[data-c15t-activated]`).count(),
    0
  );
  return "consent banner: without a stored grant the page reports its own view; accept counts the landing view once with its search referrer and later pages server-side; reject sends no view or engagement and every server report carries no consent";
}
