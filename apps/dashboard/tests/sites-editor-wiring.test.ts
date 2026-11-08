import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readDashboardSource(path: string) {
  return readFileSync(resolve(import.meta.dirname, "../src", path), "utf8");
}

const AI_ANALYTICS_PAGE = "app/(dashboard)/[slug]/geo/traffic/page-client.tsx";
const WEB_ANALYTICS_PAGE =
  "app/(dashboard)/[slug]/geo/traffic/web/page-client.tsx";
const TRAFFIC_PAGE_SHELL = "components/geo/traffic-page-shell.tsx";

test("visitor collection has no toggle in either analytics state", () => {
  const shell = readDashboardSource(TRAFFIC_PAGE_SHELL);
  const empty = shell.slice(
    shell.indexOf("function TrafficPageEmpty("),
    shell.indexOf("export function TrafficPageShell(")
  );
  expect(empty).toContain("<TrafficEmpty");
  const emptyBranch = shell.slice(
    shell.indexOf("{isEmpty ? ("),
    shell.indexOf("{children}")
  );
  expect(emptyBranch).toContain("<TrafficPageEmpty");
  for (const source of [
    shell,
    readDashboardSource(AI_ANALYTICS_PAGE),
    readDashboardSource(WEB_ANALYTICS_PAGE),
  ]) {
    expect(source).not.toContain("VisitorTrackingToggle");
  }
  expect(readDashboardSource(WEB_ANALYTICS_PAGE)).toMatch(
    /const isEmpty =\s+!scope\.isWebPending && !hasWebAnalytics\(web\)/
  );
});

test("source details use filtered pages while the domain picker keeps its full inventory", () => {
  const page = readDashboardSource(AI_ANALYTICS_PAGE);
  const filtered = page.slice(
    page.indexOf("useGeoTrafficPages("),
    page.indexOf("const pages =")
  );
  expect(filtered).toContain("scope.hostQuery");
  expect(filtered).toContain("scope.pathQuery");
  const sourceCard = page.slice(
    page.indexOf("<AiTrafficCard"),
    page.indexOf("<TrafficPagesCard")
  );
  expect(sourceCard).toContain("pages={pages}");
  expect(sourceCard).not.toContain("inventoryPages");
  const scope = readDashboardSource("lib/hooks/use-traffic-page-scope.ts");
  expect(scope).toMatch(
    /useGeoTrafficPages\(\s*organizationId,\s*geoRange\.query\s*\)/
  );
  expect(scope).toContain("trafficHostsFromPages(inventoryPages)");
});

test("an empty current window with prior traffic does not recommend reinstalling tracking", () => {
  const aiPage = readDashboardSource(AI_ANALYTICS_PAGE);
  expect(aiPage).toContain("!sources.some((source) => source.visits > 0)");
  expect(aiPage).toContain("hasPreviousData={hasPreviousData}");
  expect(aiPage).toContain("hasPreviousTraffic(sources)");
  expect(readDashboardSource(WEB_ANALYTICS_PAGE)).toContain(
    "hasPreviousData={hasPreviousWebPeriod(web)}"
  );
  const shell = readDashboardSource(TRAFFIC_PAGE_SHELL);
  const empty = shell.slice(
    shell.indexOf("function TrafficPageEmpty("),
    shell.indexOf("export function TrafficPageShell(")
  );
  const previous = empty.slice(
    empty.indexOf("if (hasPreviousData"),
    empty.indexOf("<TrafficEmpty")
  );
  expect(previous).toContain("title={copy.emptyRangeTitle}");
  expect(previous).toContain("return (");
});
