import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import sharp from "sharp";

import { optimizeContentImages } from "../compiler/content-images";
import {
  addContentImageSrcsets,
  findContentImages,
} from "../compiler/utils/content-image-tags";

const post = (body: string, outside = "") =>
  `<html><body>${outside}<article><div class="mdx-content prose" data-md-root>${body}</div></article>${outside}</body></html>`;

function photo(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#808080",
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  });
}

let outDir: string;

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "notra-content-images-"));
});

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

async function put(path: string, data: Buffer | string) {
  const file = join(outDir, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
}

async function optimize(
  pages: Record<string, string>,
  overrides: Partial<Parameters<typeof optimizeContentImages>[0]> = {}
) {
  return optimizeContentImages({
    outDir,
    pageHtml: new Map(Object.entries(pages)),
    mounts: ["/blog"],
    ...overrides,
  });
}

function srcsetOf(html: string, src: string) {
  const tag =
    html
      .match(/<img[^>]*>/g)
      ?.find(
        (img) => img.includes(`src="${src}"`) && img.includes("srcset=")
      ) ?? "";
  return {
    tag,
    candidates:
      /srcset="([^"]*)"/
        .exec(tag)?.[1]
        ?.split(", ")
        .map((candidate) => candidate.split(" ")) ?? [],
    sizes: /sizes="([^"]*)"/.exec(tag)?.[1],
  };
}

describe("findContentImages", () => {
  test("finds only images inside the content root", () => {
    const html = post(
      '<p><img src="/blog/images/in.png" alt=""></p><div><div><img src="/blog/images/nested.jpg"/></div></div>',
      '<img src="/blog/images/out.png">'
    );
    expect(findContentImages(html).map((image) => image.src)).toEqual([
      "/blog/images/in.png",
      "/blog/images/nested.jpg",
    ]);
  });

  test("skips images that are external, already responsive or carry a query", () => {
    const html = post(
      [
        '<img src="https://cdn.example.com/a.png">',
        '<img src="//cdn.example.com/a.png">',
        '<img src="/blog/images/a.png" srcset="/blog/images/a.png 1x">',
        '<img src="/blog/images/a.png?v=2">',
        '<img src="/blog/images/a,b.png">',
        '<img src="data:image/png;base64,AAAA">',
        '<img alt="no src">',
      ].join("")
    );
    expect(findContentImages(html)).toEqual([]);
  });
});

describe("addContentImageSrcsets", () => {
  const variants = [
    { url: "/blog/_notra/assets/images/a-1-640.webp", width: 640 },
    { url: "/blog/images/a.png", width: 1600 },
  ];
  const srcset =
    'srcset="/blog/_notra/assets/images/a-1-640.webp 640w, /blog/images/a.png 1600w"';

  test("adds srcset and sizes without touching the rest of the tag", () => {
    const html = post(
      '<img src="/blog/images/a.png" alt="A chart"/><img loading="lazy" src="/blog/images/a.png"><img loading="lazy" width="1600" height="900" src="/blog/images/a.png">'
    );
    const result = addContentImageSrcsets(
      html,
      findContentImages(html),
      () => variants
    );
    expect(result).toContain(
      `<img src="/blog/images/a.png" alt="A chart" ${srcset} sizes="min(1600px, 100vw)"/>`
    );
    // Without width and height, "auto" would lay a lazy image out at 300x150.
    expect(result).toContain(
      `<img loading="lazy" src="/blog/images/a.png" ${srcset} sizes="min(1600px, 100vw)">`
    );
    // With both set, browsers can pick by the rendered width.
    expect(result).toContain(
      `width="1600" height="900" src="/blog/images/a.png" ${srcset} sizes="auto, min(1600px, 100vw)">`
    );
  });

  test("keeps sizes the author set and leaves images without copies alone", () => {
    const html = post(
      '<img src="/blog/images/a.png" sizes="240px"><img src="/blog/images/b.png">'
    );
    const result = addContentImageSrcsets(
      html,
      findContentImages(html),
      (src) => (src.endsWith("a.png") ? variants : null)
    );
    expect(result).toContain(`sizes="240px" ${srcset}>`);
    expect(result).not.toContain("min(1600px");
    expect(result).toContain('<img src="/blog/images/b.png">');
  });
});

describe("optimizeContentImages", () => {
  test("writes smaller WebP copies and keeps the original as the widest candidate", async () => {
    const original = await photo(2000, 1000).jpeg({ quality: 92 }).toBuffer();
    await put("blog/images/Big Photo.jpg", original);
    const html = post(
      '<img src="/blog/images/Big%20Photo.jpg" alt="">',
      '<img src="/blog/images/Big%20Photo.jpg" alt="">'
    );
    const result = await optimize({ "/blog/post/index.html": html });

    expect(result.diagnostics).toEqual([]);
    expect(result.images).toBe(1);
    expect(result.variants).toBe(4);
    const rewritten = result.pages.get("/blog/post/index.html") ?? "";
    // Only the image in the content changes.
    expect(rewritten.match(/srcset=/g)?.length).toBe(1);
    const { candidates, sizes } = srcsetOf(
      rewritten,
      "/blog/images/Big%20Photo.jpg"
    );
    expect(sizes).toBe("min(2000px, 100vw)");
    expect(candidates.map(([, width]) => width)).toEqual([
      "640w",
      "960w",
      "1280w",
      "1920w",
      "2000w",
    ]);
    expect(candidates.at(-1)?.[0]).toBe("/blog/images/Big%20Photo.jpg");
    for (const [url, descriptor] of candidates.slice(0, -1)) {
      expect(url).toMatch(
        /^\/blog\/_notra\/assets\/images\/big-photo-[0-9a-f]{10}-\d+\.webp$/
      );
      const data = await Bun.file(join(outDir, url ?? "")).bytes();
      const meta = await sharp(data).metadata();
      expect(meta.format).toBe("webp");
      expect(`${meta.width}w`).toBe(descriptor ?? "");
      expect(data.byteLength).toBeLessThan(original.byteLength);
    }
  });

  test("uses the displayed width of rotated photos", async () => {
    // Stored landscape, shown portrait: EXIF orientation 6 rotates it 90°.
    await put(
      "blog/images/portrait.jpg",
      await photo(1600, 900).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    );
    const result = await optimize({
      "/blog/p/index.html": post('<img src="/blog/images/portrait.jpg">'),
    });
    const { candidates } = srcsetOf(
      result.pages.get("/blog/p/index.html") ?? "",
      "/blog/images/portrait.jpg"
    );
    expect(candidates.map(([, width]) => width)).toEqual(["640w", "900w"]);
    const copy = await sharp(
      await Bun.file(join(outDir, candidates[0]?.[0] ?? "")).bytes()
    ).metadata();
    expect([copy.width, copy.height]).toEqual([640, 1138]);
  });

  test("leaves small, vector, animated, missing and outside images alone", async () => {
    await put("blog/images/small.png", await photo(600, 400).png().toBuffer());
    await put(
      "blog/images/logo.svg",
      '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="10"/>'
    );
    await put("blog/images/clip.gif", await photo(1200, 600).gif().toBuffer());
    const frames = await Promise.all(
      ["#ff0000", "#0000ff"].map((background) =>
        sharp({ create: { width: 1200, height: 600, channels: 3, background } })
          .png()
          .toBuffer()
      )
    );
    const animated = await sharp(frames, { join: { animated: true } })
      .webp()
      .toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    await put("blog/images/animated.webp", animated);
    const still = await photo(1200, 600).png().toBuffer();
    const acTL = Buffer.from([
      0, 0, 0, 8, 0x61, 0x63, 0x54, 0x4c, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await put(
      "blog/images/apng.png",
      Buffer.concat([still.subarray(0, 33), acTL, still.subarray(33)])
    );
    await put("secret.jpg", await photo(1200, 600).jpeg().toBuffer());
    const images = [
      "small.png",
      "logo.svg",
      "clip.gif",
      "animated.webp",
      "apng.png",
      "missing.jpg",
    ].map((name) => `<img src="/blog/images/${name}">`);
    const html = post(`${images.join("")}<img src="/blog/../secret.jpg">`);
    const result = await optimize({ "/blog/index.html": html });
    expect(result.pages.size).toBe(0);
    expect(result.diagnostics).toEqual([]);
    expect(await readdir(outDir)).not.toContain("_notra");
  });

  test("keeps originals and warns when images or the library fail", async () => {
    await put("blog/images/broken.jpg", "not really a jpeg");
    await put("blog/images/a.jpg", await photo(1200, 600).jpeg().toBuffer());
    const codes = async (
      src: string,
      overrides: Parameters<typeof optimize>[1] = {}
    ) => {
      const result = await optimize(
        { "/blog/index.html": post(`<img src="${src}">`) },
        overrides
      );
      expect(result.pages.size).toBe(0);
      expect(result.diagnostics.every((d) => d.severity === "warning")).toBe(
        true
      );
      return result.diagnostics.map((diagnostic) => diagnostic.code);
    };
    expect(await codes("/blog/images/broken.jpg")).toEqual([
      "content_image_failed",
    ]);
    expect(
      await codes("/blog/images/a.jpg", {
        loadSharp: () => Promise.reject(new Error("no prebuilt binary")),
      })
    ).toEqual(["content_images_unavailable"]);
  });

  test("puts copies under the image's own section when mounted at the root", async () => {
    await put("images/a.jpg", await photo(1200, 600).jpeg().toBuffer());
    const result = await optimize(
      { "/index.html": post('<img src="/images/a.jpg">') },
      { mounts: ["/", "/changelog"] }
    );
    const { candidates } = srcsetOf(
      result.pages.get("/index.html") ?? "",
      "/images/a.jpg"
    );
    expect(candidates[0]?.[0]).toMatch(/^\/_notra\/assets\/images\/a-/);
  });

  test("stops at the image limit and says so", async () => {
    await put("blog/images/a.jpg", await photo(1200, 600).jpeg().toBuffer());
    // The worker starts the image on time; the deadline passes before its first copy.
    const ticks = [0, 0, 5];
    const result = await optimize(
      { "/blog/index.html": post('<img src="/blog/images/a.jpg">') },
      {
        budget: { maxImages: 10, maxDurationMs: 1, concurrency: 1 },
        now: () => ticks.shift() ?? 5,
      }
    );
    expect(result.pages.size).toBe(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "content_images_budget",
    ]);

    // Images past the count limit keep their originals too.
    await put("blog/images/b.jpg", await photo(1200, 600).jpeg().toBuffer());
    const counted = await optimize(
      {
        "/blog/index.html": post(
          '<img src="/blog/images/a.jpg"><img src="/blog/images/b.jpg">'
        ),
      },
      { budget: { maxImages: 1, maxDurationMs: 60_000, concurrency: 1 } }
    );
    expect(counted.images).toBe(1);
    expect(counted.diagnostics[0]?.message).toStartWith("1 image in posts");
  });
});

describe("copy quality", () => {
  async function psnr(a: Uint8Array, b: Uint8Array) {
    const [x, y] = await Promise.all(
      [a, b].map((image) => sharp(image).removeAlpha().raw().toBuffer())
    );
    let squared = 0;
    for (let i = 0; i < (x?.length ?? 0); i += 1) {
      const difference = (x?.[i] ?? 0) - (y?.[i] ?? 0);
      squared += difference * difference;
    }
    return 10 * Math.log10((255 * 255) / (squared / (x?.length ?? 1)));
  }

  async function copyAt(name: string, data: Buffer, width: number) {
    await put(`blog/images/${name}`, data);
    const result = await optimize({
      "/blog/index.html": post(`<img src="/blog/images/${name}">`),
    });
    const { candidates } = srcsetOf(
      result.pages.get("/blog/index.html") ?? "",
      `/blog/images/${name}`
    );
    const url = candidates.find(([, w]) => w === `${width}w`)?.[0] ?? "";
    return Bun.file(join(outDir, url)).bytes();
  }

  test("screenshots stay near-lossless, so coloured text stays sharp", async () => {
    const lines = Array.from(
      { length: 30 },
      (_, i) =>
        `<text x="40" y="${60 + i * 38}" font-family="Helvetica" font-size="28" fill="${["#111", "#d00", "#06c", "#080"][i % 4]}">Release notes ${i}: fixed the sync bug, 2026-11-05</text>`
    ).join("");
    const screenshot = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1200"><rect width="100%" height="100%" fill="#fff"/>${lines}</svg>`
      )
    )
      .png()
      .toBuffer();
    const copy = await copyAt("screenshot.png", screenshot, 1280);
    const reference = await sharp(screenshot)
      .resize({ width: 1280 })
      .png()
      .toBuffer();
    // Lossy WebP scores about 30 dB here, with visible smearing around coloured text.
    expect(await psnr(reference, copy)).toBeGreaterThan(50);
  });

  test("wide-gamut images keep their colour profile", async () => {
    const original = await photo(1600, 900)
      .withIccProfile("p3")
      .jpeg()
      .toBuffer();
    const source = await sharp(original).metadata();
    const copy = await sharp(await copyAt("p3.jpg", original, 1280)).metadata();
    expect(copy.icc).toBeDefined();
    expect(
      Buffer.from(copy.icc ?? []).equals(Buffer.from(source.icc ?? []))
    ).toBe(true);
  });

  test("CMYK images become sRGB without carrying their print profile", async () => {
    const original = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: "#d02030" },
    })
      .toColourspace("cmyk")
      .jpeg()
      .toBuffer();
    expect((await sharp(original).metadata()).space).toBe("cmyk");
    const copy = await copyAt("print.jpg", original, 1280);
    const meta = await sharp(copy).metadata();
    expect(meta.space).toBe("srgb");
    expect(meta.icc).toBeUndefined();
    const { data } = await sharp(copy)
      .extract({ left: 600, top: 300, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(170);
    expect(data[1]).toBeLessThan(80);
  });
});
