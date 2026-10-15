import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

import { renderToStaticMarkup } from "react-dom/server";

import { LiveDemoLink } from "@/components/landing/live-demo-link";
import {
  LIVE_DEMO_PREVIEW_DARK_SRC,
  LIVE_DEMO_PREVIEW_SRC,
  LIVE_DEMO_PREVIEW_THEME_SCRIPT,
  LIVE_DEMO_URL,
} from "@/constants/landing/live-demo";

describe("live demo preview delivery", () => {
  test("lets the browser select a single high-priority image before hydration", () => {
    const html = renderToStaticMarkup(<LiveDemoLink />);

    expect(html.match(/<img\b/g)).toHaveLength(1);
    expect(html).toContain("<picture>");
    expect(html).toContain('media="(prefers-color-scheme: dark)"');
    expect(html).toContain(`srcSet="${LIVE_DEMO_PREVIEW_DARK_SRC}"`);
    expect(html).toContain(`src="${LIVE_DEMO_PREVIEW_SRC}"`);
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('width="2000"');
    expect(html).toContain('height="1250"');
    expect(html).not.toContain('rel="preload"');
  });

  test("links to the demo in the same tab instead of embedding it", () => {
    const html = renderToStaticMarkup(<LiveDemoLink />);
    expect(html).toContain(`href="${LIVE_DEMO_URL}"`);
    expect(html).not.toContain("target=");
    expect(html).not.toContain("<iframe");
  });

  test("selects the applied theme before enabling the initial image request", () => {
    const html = renderToStaticMarkup(<LiveDemoLink />);

    expect(html).toContain('loading="lazy"');
    expect(html).toContain(LIVE_DEMO_PREVIEW_THEME_SCRIPT);
    expect(html.indexOf("</picture>")).toBeLessThan(html.indexOf("<script>"));
  });

  test.each([true, false])(
    "applies the page theme %s before requesting the preview",
    (dark) => {
      const events: string[] = [];
      let media = "";
      let loading = "";
      const source = {
        get media() {
          return media;
        },
        set media(value: string) {
          media = value;
          events.push(`media:${value}`);
        },
      };
      const image = {
        get loading() {
          return loading;
        },
        set loading(value: string) {
          loading = value;
          events.push(`loading:${value}`);
        },
      };
      const document = {
        currentScript: {
          previousElementSibling: {
            querySelector: (selector: string) =>
              selector === "source" ? source : image,
          },
        },
        documentElement: { classList: { contains: () => dark } },
      };

      runInNewContext(LIVE_DEMO_PREVIEW_THEME_SCRIPT, { document });
      expect(events).toEqual([
        `media:${dark ? "all" : "not all"}`,
        "loading:eager",
      ]);
      expect(source.media).toBe(dark ? "all" : "not all");
      expect(image.loading).toBe("eager");
      runInNewContext(LIVE_DEMO_PREVIEW_THEME_SCRIPT, { document });
      expect(events).toHaveLength(2);
    }
  );
});
