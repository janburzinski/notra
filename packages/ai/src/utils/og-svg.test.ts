import { describe, expect, test } from "bun:test";

import { recolorOgSvg } from "@notra/ai/utils/og-svg";

describe("recolorOgSvg", () => {
  test("recolors logos painted with named or short hex colors", () => {
    const vercel =
      '<svg viewBox="0 0 115 100"><path fill="black" d="M57.5 0 115 100H0z"/></svg>';
    expect(recolorOgSvg(vercel, "#ffffff")).toContain('fill="#ffffff"');
    const short = '<svg><path fill="#FFF" d="M0 0h1v1z"/></svg>';
    expect(recolorOgSvg(short, "#111111")).toContain('fill="#111111"');
  });

  test("ignores clip path geometry when detecting the logo color", () => {
    const svg =
      '<svg fill="none"><g clip-path="url(#c)"><path fill="black" d="M0 0h1v1z"/></g><defs><clipPath id="c"><rect width="2" height="1" fill="white"/></clipPath></defs></svg>';
    const recolored = recolorOgSvg(svg, "#ffffff");
    expect(recolored).toContain('<path fill="#ffffff"');
    expect(recolored).toContain('<rect width="2" height="1" fill="white"/>');
  });
});
