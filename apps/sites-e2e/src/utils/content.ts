import assert from "node:assert/strict";

import type { Page } from "playwright";

import { cspAllowsOrigin } from "./csp";

// Content checks select by role, accessible name, fixture text and the public
// styling contract (stable IDs, data attributes), never by theme classes or
// layout, so visual changes to the theme do not break them.

// fixtures/site/style.css points :root::after at a public file by absolute
// path; the pseudo-element has no content, so nothing renders.
function siteCssAsset(page: Page) {
  return page.evaluate(async () => {
    const value = getComputedStyle(
      document.documentElement,
      "::after"
    ).backgroundImage;
    const url = /^url\("(.+)"\)$/.exec(value)?.[1];
    if (!url) {
      return { path: value, status: 0 };
    }
    // Reads the body so the next navigation doesn't abort the request.
    const response = await fetch(url);
    await response.arrayBuffer();
    return { path: new URL(url).pathname, status: response.status };
  });
}
export async function assertContentFeatures(
  page: Page,
  origin: string,
  waitForResources: () => Promise<void>
) {
  const checks: string[] = [];
  const components = await page.goto(`${origin}/blog/components`, {
    waitUntil: "domcontentloaded",
  });
  await waitForResources();
  assert.equal(components?.status(), 200);

  for (const [title, body] of [
    ["Info callout", "Info body text."],
    ["Warning callout", "Warning body text."],
    ["Check callout", "Check body text."],
    ["Danger callout", "Danger body text."],
    ["Generic callout", "Callout body text."],
  ]) {
    const callout = page.getByRole("complementary", { name: title });
    assert.equal(await callout.count(), 1, title);
    assert.match(
      await callout.innerText(),
      new RegExp(body.replace(".", "\\."))
    );
  }
  for (const text of ["Left column card", "Right column card"]) {
    assert.equal(await page.getByText(text, { exact: true }).isVisible(), true);
  }
  checks.push("callouts (5 variants), columns with cards");

  const firstAnswer = page.getByText("First answer text.");
  assert.equal(await firstAnswer.isVisible(), false);
  await page.getByText("First question", { exact: true }).click();
  assert.equal(await firstAnswer.isVisible(), true);
  checks.push("accordion group expands on click");

  const secondTab = page.getByRole("tab", { name: "Second tab" });
  assert.equal(await page.getByText("Second tab body.").isVisible(), false);
  await secondTab.click();
  assert.equal(await secondTab.getAttribute("aria-selected"), "true");
  assert.equal(await page.getByText("Second tab body.").isVisible(), true);
  assert.equal(await page.getByText("First tab body.").isVisible(), false);
  checks.push("tabs switch panels with aria-selected");

  const steps = page.getByRole("listitem").filter({
    hasText: /Install the CLI|Publish the site/,
  });
  assert.deepEqual(
    (await steps.allInnerTexts()).map((text) => text.split("\n")[0]?.trim()),
    ["Install the CLI", "Publish the site"]
  );
  const body = await page.locator("body").innerText();
  for (const code of ["npm install acme-cloud", "bun add acme-cloud"]) {
    assert.ok(body.includes(code), code);
  }
  checks.push("ordered steps, code group blocks");

  const video = page.locator('video[title="Acme demo video"]');
  assert.match((await video.getAttribute("src")) ?? "", /\/images\/demo\.mp4$/);
  const youtube = page.locator('iframe[title="Acme on YouTube"]');
  assert.equal(
    await youtube.getAttribute("src"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  );
  const policy = components?.headers()["content-security-policy"];
  assert.ok(
    !policy ||
      cspAllowsOrigin(
        policy,
        "frame-src",
        "https://www.youtube-nocookie.com"
      ) ||
      !/(?:^|;)\s*(?:frame-src|child-src|default-src)\s/.test(policy),
    `CSP must allow the YouTube embed: ${policy}`
  );
  checks.push("video element, YouTube embed allowed by CSP");

  const sections = page.getByRole("navigation", { name: "Sections" });
  const sectionLinks = await sections
    .first()
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).pathname)
    );
  assert.ok(sectionLinks.some((path) => path.startsWith("/blog")));
  assert.ok(sectionLinks.some((path) => path.startsWith("/changelog")));
  const theme = page.getByRole("radiogroup", { name: "Theme" }).first();
  await theme.getByRole("radio", { name: "Dark" }).click();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    ),
    true
  );
  await theme.getByRole("radio", { name: "Light" }).click();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    ),
    false
  );
  checks.push("site areas navigation, theme toggle");

  assert.deepEqual(
    await page.evaluate(() => ({
      style: getComputedStyle(document.documentElement)
        .getPropertyValue("--e2e-global-style")
        .trim(),
      script: document.documentElement.dataset.e2eGlobalScript,
    })),
    { style: "loaded", script: "ran" }
  );
  checks.push("global style.css and script.js apply under the CSP");

  // fixtures/fonts.json: two self-hosted families, one with an extra face.
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('600 1em "E2E Text"');
    const faces = [...document.fonts].map((face) => ({
      name: `${face.family.replaceAll('"', "")} ${face.weight}`,
      status: face.status,
      // Chromium exposes the descriptor; TypeScript's DOM types don't yet.
      sizeAdjust: (face as FontFace & { sizeAdjust?: string }).sizeAdjust,
    }));
    const preloads = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="preload"][as="font"]'
    );
    return {
      faces,
      preloads: [...preloads].map(
        (link) =>
          `${new URL(link.href).pathname} ${link.type} ${link.crossOrigin}`
      ),
      body: getComputedStyle(document.body).fontFamily,
    };
  });
  const faces = JSON.stringify(fonts.faces);
  for (const name of ["E2E Text 400", "E2E Text 600", "E2E Display 600"]) {
    const face = fonts.faces.find((item) => item.name === name);
    assert.equal(face?.status, "loaded", `${name} loads: ${faces}`);
  }
  assert.deepEqual(
    fonts.preloads,
    ["400", "600"].map(
      (weight) => `/blog/fonts/e2e-text-${weight}.woff2 font/woff2 anonymous`
    )
  );
  for (const family of ["E2E Text Fallback", "E2E Display Fallback"]) {
    const { sizeAdjust = "" } =
      fonts.faces.find((item) => item.name.startsWith(family)) ?? {};
    assert.match(sizeAdjust, /^\d+(?:\.\d+)?%$/, `${family}: ${faces}`);
    assert.notEqual(sizeAdjust, "100%", family);
  }
  assert.match(fonts.body, /^"E2E Text", "E2E Text Fallback", /);
  checks.push(
    "self-hosted font faces load, are preloaded and get sized fallbacks"
  );

  assert.deepEqual(await siteCssAsset(page), {
    path: "/blog/images/e2e-css-asset.png",
    status: 200,
  });

  const badge = page.getByRole("link", { name: "Powered by Notra" });
  assert.equal(await badge.count(), 1);
  assert.equal(await badge.isVisible(), true);
  const badgeBox = await badge.boundingBox();
  assert.ok(
    badgeBox && badgeBox.width > 0 && badgeBox.height > 0,
    "the Notra badge keeps its size under site CSS"
  );
  checks.push("Powered by Notra badge stays visible under site CSS hiding it");

  const loaded = async (name: string) => {
    const image = page.getByRole("img", { name, exact: true });
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(
      (element) =>
        new Promise<void>((resolve, reject) => {
          const img = element as HTMLImageElement;
          if (img.complete) {
            if (img.naturalWidth > 0) {
              resolve();
            } else {
              reject(new Error(`image failed to load: ${img.currentSrc}`));
            }
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener(
            "error",
            () => reject(new Error(`image failed to load: ${img.currentSrc}`)),
            { once: true }
          );
        })
    );
    return image;
  };
  const widthsOf = async (image: Awaited<ReturnType<typeof loaded>>) =>
    ((await image.getAttribute("srcset")) ?? "")
      .split(", ")
      .map((candidate) => candidate.split(" ")[1]);

  // A srcset must not change layout: an image narrower than the column keeps its own width.
  const small = await loaded("E2E small photo");
  assert.deepEqual(await widthsOf(small), ["640w", "680w"]);
  assert.equal(
    Math.round((await small.boundingBox())?.width ?? 0),
    680,
    "an image narrower than the post keeps its width"
  );

  // A lazy image with width and height lets the browser pick by rendered width.
  // It uses its own file: a browser reuses a candidate it already has in memory.
  const sized = await loaded("E2E sized photo");
  assert.equal(await sized.getAttribute("sizes"), "auto, min(1600px, 100vw)");
  const shown = await sized.evaluate(
    (image) => new URL((image as HTMLImageElement).currentSrc).pathname
  );
  assert.match(
    shown,
    /^\/blog\/_notra\/assets\/images\/e2e-sized-photo-[0-9a-f]{10}-\d+\.webp$/,
    `the browser shows a WebP copy, not the original: ${shown}`
  );
  const copy = await page.goto(`${origin}${shown}`);
  await waitForResources();
  assert.equal(copy?.status(), 200);
  assert.equal(copy?.headers()["content-type"], "image/webp");
  assert.match(copy?.headers()["cache-control"] ?? "", /immutable/);
  checks.push(
    "content images get a WebP srcset without changing layout; copies are served immutable"
  );

  await page.goto(`${origin}/blog/hello-world`, {
    waitUntil: "domcontentloaded",
  });
  await waitForResources();
  const post = await page.locator("body").innerText();
  for (const text of [
    "Built with Acme Cloud",
    "Start free trial",
    "Jan Burzinski",
  ]) {
    assert.ok(post.includes(text), text);
  }
  // The slot interpolates the post title; quotes may be typographic.
  assert.match(post, /Enjoyed .Hello world.\?/);
  assert.equal(
    (await page.locator('a[href="mailto:help@acme.example.com"]').count()) > 0,
    true
  );
  checks.push("header/footer/after-post slot, content variables, author");

  // Every slot gets the area; its root-relative path links back to the index.
  const areaLink = page.getByRole("link", { name: "More from Acme Blog" });
  assert.equal(await areaLink.getAttribute("href"), "/blog");
  await Promise.all([page.waitForURL(`${origin}/blog`), areaLink.click()]);
  await waitForResources();
  assert.equal(new URL(page.url()).pathname, "/blog");
  checks.push("before-post slot links back to area.path");

  for (const [path, text] of [
    ["/blog/tags/components", "Every built-in component"],
    ["/changelog/tags/feature", "Component updates"],
  ]) {
    const response = await page.goto(`${origin}${path}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForResources();
    assert.equal(response?.status(), 200, path);
    assert.ok((await page.locator("body").innerText()).includes(text), path);
  }
  await page.goto(`${origin}/changelog`, { waitUntil: "domcontentloaded" });
  await waitForResources();
  const update = page.locator("#october-2026");
  assert.ok(
    (await update.innerText()).includes("The update body for October.")
  );
  checks.push("tag pages for blog and changelog, changelog Update entry");
  assert.deepEqual(await siteCssAsset(page), {
    path: "/changelog/images/e2e-css-asset.png",
    status: 200,
  });
  checks.push("absolute public-file url() in site CSS loads under each mount");

  await page.goto(`${origin}/blog/2026/launch`, {
    waitUntil: "domcontentloaded",
  });
  await waitForResources();
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  assert.ok(
    ogImage && ogImage.startsWith(origin),
    `OG image on the site: ${ogImage}`
  );
  const image = await page.goto(ogImage);
  await waitForResources();
  assert.equal(image?.status(), 200);
  assert.match(image?.headers()["content-type"] ?? "", /^image\//);
  checks.push("generated OG image is served");
  return checks;
}
