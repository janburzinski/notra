import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import sharp from "sharp";

const MAX_SCREENSHOT_BYTES = 512 * 1024;

const articles = [
  "how-to-create-a-grok-bot-plugin",
  "how-notra-uses-upstash-to-run-an-ai-content-pipeline",
];

for (const article of articles) {
  test(`${article} uses small, full-resolution WebP screenshots`, async () => {
    const source = await readFile(
      new URL(`../src/content/blog/${article}.mdx`, import.meta.url),
      "utf8"
    );
    const images = [
      ...source.matchAll(
        /<img[^>]*src="(\/blog\/(?:grok-bot-[^"/]+|upstash-content-workflow)\.[^"]+)"[^>]*\/>/g
      ),
    ];
    assert.equal(images.length, article.startsWith("how-to-create") ? 6 : 1);
    for (const [markup, src] of images) {
      assert.ok(src.endsWith(".webp"));
      const optimized = await readFile(
        new URL(`../public${src}`, import.meta.url)
      );
      const metadata = await sharp(optimized).metadata();
      assert.equal(metadata.format, "webp");
      assert.ok(optimized.length < MAX_SCREENSHOT_BYTES);
      assert.ok(markup.includes(`width="${metadata.width}"`));
      assert.ok(markup.includes(`height="${metadata.height}"`));
      assert.ok(metadata.width >= 2000);
      assert.ok(markup.includes('loading="lazy"'));
      assert.ok(markup.includes('decoding="async"'));
      await sharp(optimized).raw().toBuffer();
    }
  });
}
