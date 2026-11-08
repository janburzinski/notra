import { describe, expect, test } from "bun:test";

import type {
  WebAnalyticsScriptReports,
  WebAnalyticsVital,
} from "@notra/geo-core/types/geo";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../messages/en.json";
import { WebScriptReports } from "../src/components/geo/web-script-reports";

const t = messages.geo.webVisitors;

const EMPTY: WebAnalyticsScriptReports = {
  outboundLinks: [],
  vitals: [],
  vitalsByDevice: { mobile: [], desktop: [] },
  errors: [],
  languages: [],
};

const LCP: WebAnalyticsVital = {
  metric: "lcp",
  p75: 4600,
  samples: 40,
  good: 10,
  needsImprovement: 10,
  poor: 20,
};
const CLS: WebAnalyticsVital = {
  metric: "cls",
  p75: 14,
  samples: 400,
  good: 399,
  needsImprovement: 1,
  poor: 0,
};

function render(
  reports: WebAnalyticsScriptReports | undefined,
  { loading = false, compare = true } = {}
) {
  return renderToStaticMarkup(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <WebScriptReports compare={compare} loading={loading} reports={reports} />
    </IntlProvider>
  );
}

const text = (html: string) =>
  html
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll(/\s+/g, " ");

describe("WebScriptReports", () => {
  test("lists outbound links, languages and vitals, LCP first, with p75, rating and bands", () => {
    const html = render({
      ...EMPTY,
      outboundLinks: [
        { url: "github.com/acme", clicks: 5, previousClicks: 1, visitors: 4 },
      ],
      vitals: [CLS, LCP],
      languages: [{ value: "de", visitors: 7, previousVisitors: 2 }],
    });
    const plain = text(html);
    for (const value of [
      "github.com/acme",
      "German",
      "4.6 s",
      t.vitalPoor,
      "p75 of 40 views",
      "> 4s",
      "50%",
      // CLS is unitless; a band under 1% still shows up.
      "0.01",
      "<1%",
    ]) {
      expect(plain).toContain(value);
    }
    expect(html.indexOf(t.vitalName.lcp)).toBeLessThan(
      html.indexOf(t.vitalName.cls)
    );
  });

  test("the device switch appears only when both device classes have vitals", () => {
    expect(render({ ...EMPTY, vitals: [LCP] })).not.toContain(
      t.vitalsDeviceAll
    );
    expect(
      render({
        ...EMPTY,
        vitals: [LCP],
        vitalsByDevice: { mobile: [LCP], desktop: [CLS] },
      })
    ).toContain(t.vitalsDeviceAll);
  });

  test("outbound links get a favicon only for known domains", () => {
    const html = render({
      ...EMPTY,
      outboundLinks: ["github.com/acme", "docs.example.org/x"].map((url) => ({
        url,
        clicks: 2,
        previousClicks: 0,
        visitors: 2,
      })),
    });
    expect(html).toContain("google.com/s2/favicons?domain=github.com");
    expect(html).not.toContain("domain=docs.example.org");
  });

  test("empty states show without data, not while loading; errors only with data", () => {
    for (const reports of [EMPTY, undefined]) {
      const html = render(reports);
      expect(html).toContain(t.vitalsEmptyTitle);
      expect(html).not.toContain(t.errors);
    }
    const loading = render(undefined, { loading: true });
    expect(loading).toContain(t.webVitals);
    expect(loading).not.toContain(t.vitalsEmptyTitle);
    expect(
      render({
        ...EMPTY,
        errors: [
          { message: "x is undefined", source: "/app.js", events: 9, views: 4 },
        ],
      })
    ).toContain(t.errors);
  });

  test("rows compare with the previous period only when it has data", () => {
    const reports: WebAnalyticsScriptReports = {
      ...EMPTY,
      languages: [{ value: "de", visitors: 7, previousVisitors: 0 }],
    };
    const isNew = `>${messages.common.labels.new}<`;
    expect(render(reports)).toContain(isNew);
    expect(render(reports, { compare: false })).not.toContain(isNew);
  });
});
