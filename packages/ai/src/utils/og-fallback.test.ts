import { describe, expect, mock, test } from "bun:test";

import sharp from "sharp";

const logoPng = `data:image/png;base64,${(
  await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
).toString("base64")}`;

const actualAsset = await import("@notra/ai/utils/og-asset");
mock.module("@notra/ai/utils/og-asset", () => ({
  ...actualAsset,
  loadOgAsset: (url: string) =>
    url.includes("broken")
      ? Promise.reject(new Error("404"))
      : Promise.resolve(logoPng),
}));

const { fallbackOgTemplate } = await import("@notra/ai/utils/og-fallback");
const { renderOgImage, validateOgLayout } =
  await import("@notra/ai/utils/og-render");

function brand(guideline: unknown) {
  return {
    id: "b",
    name: "Acme",
    websiteUrl: "https://acme.dev",
    guideline,
    assets: [],
  };
}

describe("fallbackOgTemplate", () => {
  test("stays plain typography without brand evidence", async () => {
    const document = await fallbackOgTemplate(brand(null));
    expect(document.assets).toEqual({});
    expect(document.template.layers.map((layer) => layer.kind)).toEqual([
      "text",
      "text",
    ]);
  });

  test("uses the saved primary color and logo, and still renders", async () => {
    const value = brand({
      colors: [
        { role: "secondary", lightValue: "#00FF00" },
        { role: "primary", lightValue: "#635BFF" },
      ],
      assets: [
        { kind: "logo", variant: "dark", url: "https://acme.dev/dark.svg" },
        { kind: "logo", variant: "light", url: "https://acme.dev/light.svg" },
      ],
    });
    const document = await fallbackOgTemplate(value);
    const [rect, image, name] = document.template.layers;
    expect(rect).toMatchObject({ kind: "rect", color: "#635BFF" });
    expect(image).toMatchObject({ kind: "image", fit: "contain", x: 64 });
    expect(name).toMatchObject({ kind: "text", text: "Acme" });
    expect(document.assets.logo).toStartWith("data:image/png;base64,");
    validateOgLayout(document.template);
    const { pngBase64 } = await renderOgImage(document, "Hello", value);
    expect(pngBase64.length).toBeGreaterThan(0);
  });

  test("a wordmark replaces the name", async () => {
    const document = await fallbackOgTemplate(
      brand({
        colors: [],
        assets: [
          { kind: "wordmark", variant: "light", url: "https://acme.dev/w.svg" },
        ],
      })
    );
    expect(document.template.layers.map((layer) => layer.kind)).toEqual([
      "image",
      "text",
    ]);
  });

  test("ignores invalid colors and unloadable logos", async () => {
    const document = await fallbackOgTemplate(
      brand({
        colors: [{ role: "primary", lightValue: "rgb(1, 2, 3)" }],
        assets: [
          { kind: "logo", variant: "light", url: "https://acme.dev/broken" },
        ],
      })
    );
    expect(document.assets).toEqual({});
    expect(document.template.layers.map((layer) => layer.kind)).toEqual([
      "text",
      "text",
    ]);
  });
});
