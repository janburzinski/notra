import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Browser, chromium } from "playwright";

import { DEMO_START_HTML, DEMO_TURNSTILE_STUB } from "./constants/demo-start";

let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;
const bundleDirectory = mkdtempSync(join(tmpdir(), "notra-demo-start-"));

beforeAll(async () => {
  const output = join(bundleDirectory, "fixture.js");
  execFileSync(process.execPath, [
    "build",
    fileURLToPath(new URL("fixtures/demo-start.tsx", import.meta.url)),
    "--target=browser",
    "--define",
    'process.env.NODE_ENV="development"',
    "--define",
    'process.env={"NODE_ENV":"development"}',
    "--outfile",
    output,
  ]);
  const script = readFileSync(output, "utf8");
  server = createServer((request, response) => {
    const javascript = request.url === "/fixture.js";
    response.setHeader(
      "content-type",
      javascript ? "text/javascript" : "text/html"
    );
    response.end(javascript ? script : DEMO_START_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Demo fixture server has no address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
}, 30_000);

afterEach(async () => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

afterAll(async () => {
  await browser?.close();
  server?.close();
  rmSync(bundleDirectory, { recursive: true, force: true });
});

test("waits for verification, supports keyboard entry, and submits once under StrictMode", async () => {
  const page = await browser.newPage();
  const bodies: string[] = [];
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: DEMO_TURNSTILE_STUB })
  );
  await page.route("**/api/demo/sandbox", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ slug: "demo-synthetic" }),
    });
  });
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "Verify demo access" }).waitFor();
  expect(bodies).toHaveLength(0);
  await page.keyboard.press("Tab");
  expect(
    await page
      .getByRole("button", { name: "Verify demo access" })
      .evaluate((button) => button === document.activeElement)
  ).toBe(true);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/finished");
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0] ?? "{}")["cf-turnstile-response"]).toBe(
    "synthetic-token-1"
  );
});

test("a busy response requires a fresh token and an explicit retry without an automatic loop", async () => {
  const page = await browser.newPage();
  const tokens: string[] = [];
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: DEMO_TURNSTILE_STUB })
  );
  await page.route("**/api/demo/sandbox", async (route) => {
    tokens.push(route.request().postDataJSON()["cf-turnstile-response"]);
    await route.fulfill({
      status: tokens.length === 1 ? 503 : 201,
      contentType: "application/json",
      body: JSON.stringify({ slug: "demo-synthetic" }),
    });
  });
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "Verify demo access" }).click();
  const retry = page.getByRole("button", { name: "Try again" });
  await retry.waitFor();
  expect(await retry.isDisabled()).toBe(true);
  await page.getByRole("button", { name: "Verify demo access" }).click();
  expect(tokens).toHaveLength(1);
  await retry.click();
  await page.waitForURL("**/finished");
  expect(tokens).toEqual(["synthetic-token-1", "synthetic-token-2"]);
});

test("missing configuration and script failure never submit", async () => {
  for (const unconfigured of [true, false]) {
    const page = await browser.newPage();
    let submissions = 0;
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.abort()
    );
    await page.route("**/api/demo/sandbox", (route) => {
      submissions += 1;
      return route.abort();
    });
    await page.goto(`${baseUrl}${unconfigured ? "?unconfigured" : ""}`);
    await page
      .getByText(
        unconfigured
          ? "The demo is temporarily unavailable"
          : "The verification couldn't load. Please reload the page to try again."
      )
      .waitFor();
    expect(submissions).toBe(0);
  }
});
