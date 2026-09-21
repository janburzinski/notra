import { describe, expect, mock, test } from "bun:test";

import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DESIGN_SYSTEM_SEARCH_GAPS } from "@/constants/design-system-gaps";

// Render the sheet body without a browser portal; keyboard and scrolling are
// exercised in the design-system preview.
mock.module("@notra/ui/components/ui/sheet", () => ({
  Sheet: ({ children, open }: ComponentProps<"dialog">) =>
    open ? <div>{children}</div> : null,
  SheetContent: "div",
  SheetDescription: "p",
  SheetFooter: "footer",
  SheetHeader: "header",
  SheetScrollArea: "div",
  SheetTitle: "h2",
  SheetTrigger: "button",
  SheetClose: "button",
  SheetPortal: "div",
  SheetOverlay: "div",
}));

const { SearchGapDetailSheet } =
  await import("@/components/geo/search-gap-detail");

describe("search gap drawer", () => {
  test("shows aggregate metrics, every related page, and handles missing or zero demand", () => {
    const row = {
      ...DESIGN_SYSTEM_SEARCH_GAPS[0]!,
      impressions: 400,
      clicks: 7,
      position: 9.6,
      recommendation: {
        action: "merge" as const,
        reason: "Two pages overlap with these queries.",
        targets: [
          {
            kind: "page" as const,
            id: "first",
            title: "First matching page",
            url: "https://example.com/first",
            score: 0.73,
          },
          {
            kind: "post" as const,
            id: "second",
            title: "Second matching draft",
            url: null,
            score: 0.41,
          },
        ],
      },
    };
    const html = renderToStaticMarkup(
      <SearchGapDetailSheet
        actions={<button type="button">Merge pages</button>}
        onOpenChange={() => undefined}
        row={row}
      />
    );
    expect(html).toContain("1.8%");
    expect(html).toContain("#9.6");
    expect(html).toContain("First matching page");
    expect(html).toContain("Second matching draft");
    expect(html).toContain('href="https://example.com/first"');
    expect(html).toContain("73% match");
    expect(html).toContain("41% match");
    expect(html).toContain("Merge pages</button>");

    for (const metrics of [
      { impressions: 0, clicks: 0 },
      { impressions: null, clicks: 7 },
      { impressions: 400, clicks: null },
    ]) {
      const empty = renderToStaticMarkup(
        <SearchGapDetailSheet
          onOpenChange={() => undefined}
          row={{
            ...row,
            ...metrics,
            position: null,
            queries: [],
            recommendation: {
              action: "create",
              reason: "No matching content.",
              targets: [],
            },
          }}
        />
      );
      expect(empty).toMatch(/Click-through rate<\/dt><dd[^>]*>—<\/dd>/);
      expect(empty).toContain("No query-level data available for this gap.");
      expect(empty).toContain("No related page found.");
      expect(empty).not.toContain("NaN");
      expect(empty).not.toContain("Infinity");
    }
    const zeroClicks = renderToStaticMarkup(
      <SearchGapDetailSheet
        onOpenChange={() => undefined}
        row={{ ...row, clicks: 0 }}
      />
    );
    expect(zeroClicks).toMatch(/Click-through rate<\/dt><dd[^>]*>0%<\/dd>/);
  });
});
