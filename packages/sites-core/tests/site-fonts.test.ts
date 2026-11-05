import { afterEach, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";

import { downloadSiteFonts, planSiteFonts } from "../src/utils/site-fonts";

const fetchMock = spyOn(globalThis, "fetch");

afterEach(() => {
  fetchMock.mockReset();
});

function googleFonts(fontUrl: string) {
  fetchMock.mockImplementation((async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.host === "fonts.googleapis.com") {
      return new Response(
        `/* latin */\n@font-face {\n  font-family: 'Lato';\n  src: url(${fontUrl}) format('woff2');\n}\n`
      );
    }
    if (url.host === "raw.githubusercontent.com") {
      return url.pathname.endsWith("/ofl/lato/OFL.txt")
        ? new Response("SIL Open Font License")
        : new Response("missing", { status: 404 });
    }
    if (url.host === "fonts.gstatic.com") {
      return new Response(new Uint8Array([119, 79, 70, 50]));
    }
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch);
}

test("sites without Google Fonts plan nothing", async () => {
  expect(await planSiteFonts(undefined)).toBeNull();
  expect(
    await planSiteFonts({
      family: "Brand",
      source: "/fonts/brand.woff2",
      format: "woff2",
    })
  ).toBeNull();
});

test("the cache key keeps the builder's earlier formula, so older toolchains find prefetched fonts", async () => {
  const plan = await planSiteFonts({ family: "Lato" });
  expect(plan?.families).toEqual(["Lato"]);
  const expected = createHash("sha256")
    .update(plan?.url ?? "")
    .update(JSON.stringify(plan?.candidates))
    .digest("hex");
  expect(plan?.key).toBe(expected);
  expect(plan?.url).toBe(
    "https://fonts.googleapis.com/css2?family=Lato%3Awght%40300..800&display=swap"
  );
  expect(await planSiteFonts({ family: "Lato" })).toEqual(plan);
});

test("downloads point the stylesheet at local files and keep the license", async () => {
  googleFonts("https://fonts.gstatic.com/s/lato/v24/lato.woff2");
  const plan = await planSiteFonts({ family: "Lato" });
  if (!plan) {
    throw new Error("Lato needs a plan");
  }
  const files = await downloadSiteFonts(plan);
  const names = files.map((file) => file.name);
  expect(names).toHaveLength(3);
  const css = files.find((file) => file.name.endsWith(".css"));
  const font = files.find((file) => file.name.endsWith(".woff2"));
  const license = files.find((file) => file.name.startsWith("font-license-"));
  expect(font?.data).toEqual(new Uint8Array([119, 79, 70, 50]));
  expect(new TextDecoder().decode(license?.data)).toBe("SIL Open Font License");
  const stylesheet = new TextDecoder().decode(css?.data);
  expect(stylesheet).toContain(`url("./${font?.name}")`);
  expect(stylesheet).not.toContain("https://");
});

test("font files from any host but fonts.gstatic.com are refused", async () => {
  googleFonts("https://evil.example/s/lato/v24/lato.woff2");
  const plan = await planSiteFonts({ family: "Lato" });
  if (!plan) {
    throw new Error("Lato needs a plan");
  }
  await expect(downloadSiteFonts(plan)).rejects.toThrow(
    "Unsupported font file URL"
  );
});

test("an aborted download stops taking files from its queue", async () => {
  const controller = new AbortController();
  const fontUrls = Array.from(
    { length: 12 },
    (_, index) => `https://fonts.gstatic.com/s/lato/v24/lato-${index}.woff2`
  );
  let fontRequests = 0;
  fetchMock.mockImplementation((async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.host === "fonts.googleapis.com") {
      return new Response(
        `@font-face { font-family: 'Lato'; src: ${fontUrls.map((font) => `url(${font})`).join(", ")}; }`
      );
    }
    if (url.host === "raw.githubusercontent.com") {
      return new Response("SIL Open Font License");
    }
    fontRequests += 1;
    controller.abort();
    return new Response(new Uint8Array([1]));
  }) as typeof fetch);
  const plan = await planSiteFonts({ family: "Lato" });
  if (!plan) {
    throw new Error("Lato needs a plan");
  }
  await expect(downloadSiteFonts(plan, controller.signal)).rejects.toThrow();
  expect(fontRequests).toBeLessThan(fontUrls.length);
});
