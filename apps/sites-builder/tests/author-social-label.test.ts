import { describe, expect, test } from "bun:test";

import { authorSocialLabel } from "../src/utils/author-social-label";

describe("authorSocialLabel", () => {
  test("names each network", () => {
    expect(authorSocialLabel({ kind: "x", url: "https://x.com/ada" })).toBe(
      "X"
    );
    expect(
      authorSocialLabel({ kind: "github", url: "https://github.com/ada" })
    ).toBe("GitHub");
  });

  test("shows a website by its host without www", () => {
    expect(
      authorSocialLabel({ kind: "website", url: "https://www.ada.dev/about" })
    ).toBe("ada.dev");
  });
});
