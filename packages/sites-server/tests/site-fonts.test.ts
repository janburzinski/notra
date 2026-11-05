import { afterAll, beforeEach, expect, spyOn, test } from "bun:test";

import { planSiteFonts } from "@notra/sites-core/utils/site-fonts";

import * as editor from "../src/editor";
import { prefetchSiteFonts } from "../src/site-fonts";
import type { SiteRepositoryAccess } from "../src/types/github";
import type { Site } from "../src/types/sites";

const site = { rootDirectory: "docs/site" } as Site;
const access = {} as SiteRepositoryAccess;
const encoder = new TextEncoder();
const committed = spyOn(editor, "publishedConfig");
const fetchMock = spyOn(globalThis, "fetch");

beforeEach(() => {
  committed.mockReset().mockResolvedValue("");
  fetchMock.mockReset().mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.host === "fonts.googleapis.com") {
      const family = url.searchParams.get("family")?.split(":")[0] ?? "";
      return new Response(
        `@font-face { font-family: '${family}'; src: url(https://fonts.gstatic.com/s/x/v1/x.woff2); }`
      );
    }
    if (url.host === "raw.githubusercontent.com") {
      return new Response("OFL");
    }
    return new Response(new Uint8Array([1, 2, 3]));
  });
});

afterAll(() => {
  committed.mockRestore();
  fetchMock.mockRestore();
});

const prefetch = (
  overrides: Partial<Parameters<typeof prefetchSiteFonts>[0]>
) =>
  prefetchSiteFonts({
    site,
    commitSha: "abc123",
    access,
    overlayFiles: [],
    defaultConfig: undefined,
    ...overrides,
  });

test("uses the committed blog.json at the build's commit", async () => {
  committed.mockResolvedValue(
    JSON.stringify({ name: "Acme", fonts: { family: "Lato" } })
  );
  const fonts = await prefetch({});
  expect(committed).toHaveBeenCalledWith(site, "abc123", access);
  expect(fonts?.key).toBe((await planSiteFonts({ family: "Lato" }))?.key);
  expect(fonts?.files.some((file) => file.name.endsWith(".css"))).toBe(true);
});

test("a previewed blog.json wins over the committed one", async () => {
  committed.mockResolvedValue(
    JSON.stringify({ name: "Acme", fonts: { family: "Lato" } })
  );
  const fonts = await prefetch({
    overlayFiles: [
      {
        path: "docs/site/blog.json",
        data: encoder.encode(
          JSON.stringify({ name: "Acme", fonts: { family: "Inter" } })
        ),
      },
    ],
  });
  expect(committed).not.toHaveBeenCalled();
  expect(fonts?.key).toBe((await planSiteFonts({ family: "Inter" }))?.key);
});

test("without a blog.json the dashboard's default config decides", async () => {
  const fonts = await prefetch({
    defaultConfig: { name: "Acme", fonts: { heading: { family: "Lora" } } },
  });
  expect(fonts?.key).toBe(
    (await planSiteFonts({ heading: { family: "Lora" } }))?.key
  );
});

test("sites without Google Fonts download nothing", async () => {
  committed.mockResolvedValue(JSON.stringify({ name: "Acme" }));
  expect(await prefetch({})).toBeNull();
  committed.mockResolvedValue(JSON.stringify({ fonts: { family: "Lato" } }));
  expect(await prefetch({})).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
