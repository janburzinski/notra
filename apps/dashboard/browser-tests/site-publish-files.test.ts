import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Browser, chromium, type Route } from "playwright";

let browser: Browser;
let script: string;
const bundleDirectory = mkdtempSync(join(tmpdir(), "notra-site-publish-"));

beforeAll(async () => {
  const output = join(bundleDirectory, "fixture.js");
  execFileSync(process.execPath, [
    "build",
    fileURLToPath(new URL("fixtures/site-publish-files.tsx", import.meta.url)),
    "--target=browser",
    "--define",
    'process.env.NODE_ENV="production"',
    "--outfile",
    output,
  ]);
  script = readFileSync(output, "utf8");
  browser = await chromium.launch();
}, 30_000);

afterEach(async () => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

afterAll(async () => {
  await browser?.close();
  rmSync(bundleDirectory, { recursive: true, force: true });
});

async function fixture() {
  const page = await browser.newPage();
  let onRequest: (route: Route) => void;
  await page.route("http://publish.test/", (route) =>
    route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' })
  );
  await page.route("**/rpc/**", (route) => onRequest(route));
  await page.goto("http://publish.test/");
  await page.addScriptTag({ content: script });
  await page.getByRole("button", { name: "Publish", exact: true }).waitFor();
  return {
    page,
    async publish() {
      const pending = new Promise<Route>((resolve) => {
        onRequest = resolve;
      });
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      return pending;
    },
  };
}

async function complete(route: Route, path: string) {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ json: { files: [], drafts: [{ path }] } }),
  });
}

test.each(["Site B", "Other organization"])(
  "late drafts cannot follow navigation to %s or clear its pending request",
  async (destination) => {
    const { page, publish } = await fixture();
    const first = await publish();
    await page.getByRole("button", { name: destination, exact: true }).click();
    expect(await page.getByTestId("preparing").textContent()).toBe("false");
    const second = await publish();
    const response = page.waitForResponse((result) =>
      result.url().includes("/rpc/")
    );
    await complete(first, "site-a.json");
    await (await response).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    );
    expect(await page.getByTestId("drafts").textContent()).toBe("None");
    expect(await page.getByTestId("preparing").textContent()).toBe("true");
    await complete(second, "current.json");
    await page
      .getByTestId("drafts")
      .filter({ hasText: "current.json" })
      .waitFor();
    expect(await page.getByTestId("preparing").textContent()).toBe("false");
  }
);

test("already loaded drafts disappear on navigation and do not reappear on return", async () => {
  const { page, publish } = await fixture();
  await complete(await publish(), "site-a.json");
  await page.getByTestId("drafts").filter({ hasText: "site-a.json" }).waitFor();
  await page.getByRole("button", { name: "Site B", exact: true }).click();
  expect(await page.getByTestId("drafts").textContent()).toBe("None");
  await page.getByRole("button", { name: "Site A", exact: true }).click();
  expect(await page.getByTestId("drafts").textContent()).toBe("None");
});

test("a request from an earlier visit stays stale after returning to its site", async () => {
  const { page, publish } = await fixture();
  const first = await publish();
  await page.getByRole("button", { name: "Site B", exact: true }).click();
  await page.getByRole("button", { name: "Site A", exact: true }).click();
  const response = page.waitForResponse((result) =>
    result.url().includes("/rpc/")
  );
  await complete(first, "earlier-visit.json");
  await (await response).finished();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  expect(await page.getByTestId("drafts").textContent()).toBe("None");
  expect(await page.getByTestId("preparing").textContent()).toBe("false");
});

test("an error from the previous site cannot show a toast or stop preparation", async () => {
  const { page, publish } = await fixture();
  const first = await publish();
  await page.getByRole("button", { name: "Site B", exact: true }).click();
  const second = await publish();
  const failed = page.waitForResponse((response) => response.status() === 500);
  await first.fulfill({ status: 500, body: "Previous site failed" });
  await (await failed).finished();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  expect(await page.getByTestId("preparing").textContent()).toBe("true");
  await complete(second, "site-b.json");
  await page.getByTestId("drafts").filter({ hasText: "site-b.json" }).waitFor();
  expect(await page.locator("[data-sonner-toast]").count()).toBe(0);
});
