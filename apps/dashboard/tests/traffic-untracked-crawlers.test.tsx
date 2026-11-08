import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type {
  AiTrafficResponse,
  WebAnalyticsResponse,
} from "@notra/geo-core/types/geo";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../messages/en.json";

// mock.module leaks across files, so the assertions run in their own process.
if (!process.env.NOTRA_UNTRACKED_CRAWLERS_TEST_WORKER) {
  test("hero metrics explain crawlers notra.js can't see", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_UNTRACKED_CRAWLERS_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  });
} else {
  mock.module("../src/components/framework/link", () => ({ default: "a" }));

  const { WebVisitorsSection } =
    await import("../src/components/geo/web-visitors-section");
  const { TrafficHero } = await import("../src/components/geo/traffic-hero");

  const NEW = `>${messages.common.labels.new}<`;
  // renderToStaticMarkup escapes the apostrophe.
  const UNTRACKED = messages.geo.trafficHero.crawlersUntracked.replaceAll(
    "'",
    "&#x27;"
  );
  const AGENTS = messages.geo.webVisitors.agents;
  const action = <button type="button">Track crawlers now</button>;

  const web = (previousViews: number): WebAnalyticsResponse => ({
    configured: true,
    hosts: [],
    totals: {
      views: 20,
      previousViews,
      visitors: 10,
      previousVisitors: previousViews,
      sessions: 10,
      previousSessions: previousViews,
      engagedSessions: 0,
      aiVisitors: 0,
      previousAiVisitors: 0,
    },
    points: [{ day: "2026-11-04", views: 20, visitors: 10 }],
    pages: [
      {
        host: "acme.test",
        path: "/pricing",
        views: 20,
        previousViews: 0,
        visitors: 10,
        landings: 10,
        aiVisitors: 0,
      },
    ],
    sources: [],
    countries: [],
    devices: [],
    outcomes: [],
  });

  const traffic = (crawler: number): AiTrafficResponse => ({
    configured: true,
    totals: { crawler, cited: 0, aiReferral: 3, conversions: null },
    previousConversions: null,
    sources: [],
    points: [],
  });

  const render = (node: ReactElement) =>
    renderToStaticMarkup(
      <IntlProvider locale="en" messages={messages} timeZone="UTC">
        {node}
      </IntlProvider>
    );

  const engagement = {
    views: 20,
    avgSeconds: 42,
    previousAvgSeconds: 30,
    pages: [],
  };
  const { avgTime: AVG_TIME, fromAi: FROM_AI } = messages.geo.webVisitors;

  test.each([
    ["projects show time on page, not AI agents", { engagement }, true, false],
    [
      "time on page only shows when the caller passes it",
      { traffic: traffic(4), web: { ...web(10), engagement } },
      false,
      true,
    ],
    [
      "the AI analytics people section keeps a real zero of AI agents",
      { traffic: traffic(0) },
      false,
      true,
    ],
  ] as const)("web: %s", (_name, props, avgTime, agents) => {
    const html = render(<WebVisitorsSection web={web(10)} {...props} />);
    expect(html).toContain(FROM_AI);
    expect(html.includes(AVG_TIME)).toBe(avgTime);
    expect(html.includes(AGENTS)).toBe(agents);
    expect(html).not.toContain(UNTRACKED);
  });

  test("web: a first period has nothing to compare, so rows show no New", () => {
    expect(render(<WebVisitorsSection web={web(0)} />)).not.toContain(NEW);
    expect(render(<WebVisitorsSection web={web(10)} />)).toContain(NEW);
  });

  test("agents: untracked crawler stages get a dash, the chart a key", () => {
    const hero = (crawler: number) =>
      render(
        <TrafficHero
          crawlerSetup={action}
          days={["2026-11-03", "2026-11-04"]}
          groups={[]}
          points={[]}
          previousTotals={null}
          settingsHref="/acme/geo/settings"
          totals={{ crawler, cited: 0, aiReferral: 3, conversions: null }}
        />
      );
    expect(hero(0)).toContain(UNTRACKED);
    expect(hero(0)).toContain("Track crawlers now");
    expect(hero(5)).not.toContain(UNTRACKED);
  });
}
