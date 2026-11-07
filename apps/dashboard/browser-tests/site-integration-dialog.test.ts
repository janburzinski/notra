import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import {
  type Browser,
  chromium,
  expect as browserExpect,
} from "playwright/test";

import {
  SITE_INTEGRATION_CLIENT_ID,
  SITE_INTEGRATION_DIALOG_HTML,
  SITE_INTEGRATION_PULL_REQUEST_URL,
} from "./constants/site-integration-dialog";

let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;

beforeAll(async () => {
  const fixture = fileURLToPath(
    new URL("fixtures/site-integration-dialog.tsx", import.meta.url)
  );
  const script = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("utils/build-site-workspace.mjs", import.meta.url)),
      fixture,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  server = createServer((request, response) => {
    const javascript = request.url === "/fixture.js";
    response.setHeader(
      "content-type",
      javascript ? "text/javascript" : "text/html"
    );
    response.end(javascript ? script : SITE_INTEGRATION_DIALOG_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No fixture address");
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
});

test("editing changes nothing until Save opens a pull request", async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const save = page.getByRole("button", { name: "Save", exact: true });
  const clientId = page.getByRole("textbox", { name: "Client ID" });
  await browserExpect(save).toBeDisabled();
  await browserExpect(page.getByRole("button", { name: "Remove" })).toHaveCount(
    0
  );
  await browserExpect(page.getByText("data-client-id")).toHaveCount(0);

  await clientId.fill("bad id!");
  await clientId.blur();
  await browserExpect(save).toBeDisabled();
  await browserExpect(
    page.getByText("Copy the Client ID from your Databuddy website settings")
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "integrationCalls"))
  ).toEqual([]);

  await clientId.fill(SITE_INTEGRATION_CLIENT_ID);
  const errors = page.getByRole("switch", { name: "Errors" });
  await errors.click();
  await save.click();
  await browserExpect(page.getByText("Pull request opened")).toBeVisible();
  await browserExpect(
    page.getByRole("link", { name: "View pull request" })
  ).toHaveAttribute("href", SITE_INTEGRATION_PULL_REQUEST_URL);
  await browserExpect(page.getByText(/Draft saved/)).toHaveCount(0);
  await browserExpect(save).toBeDisabled();
  expect(
    await page.evaluate(() => Reflect.get(window, "integrationCalls"))
  ).toEqual([
    {
      organizationId: "org-synthetic",
      siteId: "site-synthetic",
      provider: "databuddy",
      settings: {
        clientId: SITE_INTEGRATION_CLIENT_ID,
        trackWebVitals: false,
        trackErrors: true,
        trackOutgoingLinks: false,
        trackInteractions: false,
      },
    },
  ]);

  await errors.click();
  await browserExpect(page.getByText("Pull request opened")).toHaveCount(0);
  await browserExpect(save).toBeEnabled();
}, 20_000);

test("Remove opens a pull request that removes the integration", async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/?existing`);
  await browserExpect(
    page.getByRole("button", { name: "Save", exact: true })
  ).toBeDisabled();
  const remove = page.getByRole("button", { name: "Remove" });
  await remove.click();
  await browserExpect(page.getByText("Pull request opened")).toBeVisible();
  await browserExpect(remove).toBeDisabled();
  expect(
    await page.evaluate(() => Reflect.get(window, "integrationCalls"))
  ).toEqual([
    {
      organizationId: "org-synthetic",
      siteId: "site-synthetic",
      provider: "databuddy",
      settings: null,
    },
  ]);
}, 20_000);
