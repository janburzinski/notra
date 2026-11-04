import { describe, expect, test } from "bun:test";

import { fitOgLogoBox, trimOgLogo } from "@notra/ai/utils/og-asset";
import sharp from "sharp";

const dataUri = (png: Buffer) =>
  `data:image/png;base64,${png.toString("base64")}`;
const size = async (data: string) =>
  sharp(Buffer.from(data.split(",")[1] ?? "", "base64")).metadata();

describe("trimOgLogo", () => {
  test("removes transparent padding around a logo", async () => {
    const padded = await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><rect x="60" y="0" width="140" height="40" fill="#000"/></svg>'
      )
    )
      .png()
      .toBuffer();
    expect((await size(await trimOgLogo(dataUri(padded)))).width).toBe(140);
  });

  test("keeps an opaque app-icon tile whole", async () => {
    const tile = await sharp({
      create: { width: 100, height: 100, channels: 4, background: "#1d4ed8" },
    })
      .png()
      .toBuffer();
    expect((await size(await trimOgLogo(dataUri(tile)))).width).toBe(100);
  });
});

describe("fitOgLogoBox", () => {
  test("shrinks a small left-aligned logo around its vertical center", () => {
    expect(
      fitOgLogoBox({ x: 80, y: 510, width: 210, height: 40 }, 126, 24)
    ).toEqual({ x: 80, y: 515, width: 157, height: 30 });
  });

  test("keeps centered and right-aligned logos on their anchor", () => {
    expect(
      fitOgLogoBox({ x: 500, y: 60, width: 200, height: 40 }, 100, 20).x
    ).toBe(538);
    expect(
      fitOgLogoBox({ x: 920, y: 60, width: 200, height: 40 }, 100, 20).x
    ).toBe(995);
  });
});
