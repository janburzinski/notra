import { expect, spyOn, test } from "bun:test";

import { CONTRIBUTORS_DATA } from "@/constants/contributors-data";
import { FOOTER_LINK_COLUMNS } from "@/constants/landing/footer";
import { buildContributorsMarkdown } from "@/lib/contributors/markdown";
import { fetchContributorsData } from "@/utils/github";

test("contributors use the static snapshot without exposing repository activity", async () => {
  const data = await fetchContributorsData();

  expect(data).toBe(CONTRIBUTORS_DATA);
  expect(data.contributors.length).toBeGreaterThan(0);
  expect(Object.keys(data).sort()).toEqual(["contributors", "notraAiPrCount"]);
});

test("the footer does not link to contributors", () => {
  const links = FOOTER_LINK_COLUMNS.flatMap((column) =>
    column.groups.flatMap((group) => group.links)
  );

  expect(links.some((link) => link.href === "/contributors")).toBe(false);
});

test("the contributors markdown works offline and omits the removed activity section", async () => {
  const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("Network access must not be needed for contributor data")
  );

  try {
    const markdown = await buildContributorsMarkdown();

    expect(fetchSpy).not.toHaveBeenCalled();
    for (const contributor of CONTRIBUTORS_DATA.contributors) {
      expect(markdown).toContain(
        `[${contributor.login}](${contributor.html_url})`
      );
    }
    expect(markdown).toContain("## Sponsors");
    expect(markdown).not.toContain("Pick something up today");
    expect(markdown).not.toContain("open issues");
    expect(markdown).not.toContain("Open pull requests");
    expect(markdown).not.toContain("/issues)");
    expect(markdown).not.toContain("/pulls)");
  } finally {
    fetchSpy.mockRestore();
  }
});
