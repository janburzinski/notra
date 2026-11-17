import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../messages/en.json";
import type { TrafficPageScope } from "../src/types/geo-traffic-pages";

if (!process.env.NOTRA_TRAFFIC_PAGE_SHELL_TEST_WORKER) {
  test("traffic page toolbar contract", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_TRAFFIC_PAGE_SHELL_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  const none = () => null;
  mock.module("../src/components/analytics/analytics-source-tabs", () => ({
    AnalyticsSourceTabs: ({ actions }: { actions?: ReactNode }) => (
      <div data-toolbar="">{actions}</div>
    ),
  }));
  const marker = (name: string) => {
    function Marker() {
      return <i data-part={name} />;
    }
    return Marker;
  };
  for (const [path, name] of [
    ["../src/components/geo/geo-range-picker", "GeoRangePicker"],
    ["../src/components/geo/geo-setup-button", "GeoSetupButton"],
    ["../src/components/geo/traffic-domain-select", "TrafficDomainSelect"],
    ["../src/components/geo/traffic-empty", "TrafficEmpty"],
    ["../src/components/geo/traffic-actions-menu", "TrafficActionsMenu"],
    ["../src/components/geo/traffic-path-empty", "TrafficPathEmpty"],
    ["../src/components/geo/traffic-path-filter", "TrafficPathFilter"],
    [
      "../src/components/geo/untracked-domain-banner",
      "TrafficUntrackedDomainBanner",
    ],
  ] as const) {
    mock.module(path, () => ({ [name]: marker(name) }));
  }
  const { TrafficPageShell } =
    await import("../src/components/geo/traffic-page-shell");

  const scope = {
    organizationId: "org",
    pathQuery: "",
    knownPaths: [],
    knownHosts: [],
    siteHosts: [],
    hasProject: true,
    hasGeoSettings: true,
    geoRange: { query: {} },
  } as unknown as TrafficPageScope;

  const render = (isEmpty: boolean, hasPreviousData: boolean) =>
    renderToStaticMarkup(
      <IntlProvider locale="en" messages={messages} timeZone="UTC">
        <TrafficPageShell
          copy={{
            description: "Visitors",
            emptyRangeTitle: "No visits in this period",
            emptyRangeDescription: "Pick another period",
            websiteDescription: "Enter your site",
          }}
          emptyFooter={() => <aside>import history</aside>}
          hasPreviousData={hasPreviousData}
          isEmpty={isEmpty}
          scope={scope}
        >
          <p>report</p>
        </TrafficPageShell>
      </IntlProvider>
    );
  const toolbar = (html: string) =>
    [
      ...(html.match(/<div data-toolbar="">(.*?)<\/div>/)?.[1] ?? "").matchAll(
        /data-part="(\w+)"/g
      ),
    ].map((match) => match[1]);

  test.each([
    [false, true, ["TrafficPathFilter", "TrafficActionsMenu"]],
    [true, true, ["TrafficActionsMenu"]],
    [true, false, ["TrafficActionsMenu"]],
  ])(
    "empty %p, previous data %p: the toolbar shows %p",
    (isEmpty, hasPreviousData, parts) => {
      const html = render(isEmpty, hasPreviousData);
      expect(toolbar(html)).toEqual(parts);
      expect(html.includes("report")).toBe(!isEmpty);
      expect(html.includes("import history")).toBe(isEmpty);
    }
  );
}
