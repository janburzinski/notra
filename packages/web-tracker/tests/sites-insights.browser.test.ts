import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { Browser } from "playwright-core";

import { ANALYTICS_SCRIPT } from "../../../apps/sites/src/constants/analytics";
import {
  hasChromium,
  launchChromium,
  startServers,
  waitFor,
} from "./utils/browser";

// The Notra Sites engagement script shares the no-layout-on-load rule.
const TAG = `<script defer src="/notra.js" data-endpoint="{{endpoint}}"></script>`;
const servers = startServers(ANALYTICS_SCRIPT, {
  "*": `<html><body><div style="height:4000px">long</div>${TAG}</body></html>`,
});
let browser: Browser;

beforeAll(async () => {
  if (hasChromium()) {
    browser = await launchChromium();
  }
});
afterAll(async () => {
  await browser?.close();
  servers.stop();
});

describe.skipIf(!hasChromium())("Sites insights.js in Chromium", () => {
  test("reports visible time and the deepest scroll when the page is left", async () => {
    const context = await browser.newContext({
      viewport: { width: 800, height: 1000 },
    });
    const page = await context.newPage();
    await page.goto(`${servers.origin}/post`);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(50);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.goto("about:blank");
    await waitFor(() => servers.collected.length === 1);
    await context.close();

    const body = servers.collected[0]?.body ?? {};
    const depth = Number(body.sd);
    expect(body).toMatchObject({
      p: "/post",
      v: expect.stringMatching(/^[a-z0-9]{16,24}$/),
    });
    expect(Number(body.ms)).toBeGreaterThan(0);
    expect(depth).toBeGreaterThanOrEqual(49);
    expect(depth).toBeLessThanOrEqual(51);
  });
});
