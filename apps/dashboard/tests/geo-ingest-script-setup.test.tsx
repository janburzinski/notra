import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../messages/en.json";
import type { DashboardGeoIngestSetup } from "../src/types/geo";

if (!process.env.NOTRA_SCRIPT_SETUP_TEST_WORKER) {
  test("tracking setup renders the script tag, its options and the status", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_SCRIPT_SETUP_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  let firstDay: string | null = null;
  mock.module("../src/lib/hooks/use-geo", () => ({
    useGeoWebKeyRotate: () => ({ isPending: false, mutate: () => undefined }),
  }));
  mock.module("../src/components/providers/organization-provider", () => ({
    useOrganizationsContext: () => ({ activeOrganization: { id: "org_1" } }),
  }));
  mock.module("../src/lib/hooks/use-web-tracking-status", () => ({
    useWebTrackingStatus: () => ({ data: { firstDay } }),
  }));
  mock.module("../src/lib/hooks/use-web-analytics-flag", () => ({
    useWebAnalyticsFlag: () => ({ enabled: true, settled: true }),
  }));
  mock.module("../src/components/framework/link", () => ({ default: "a" }));
  mock.module("../src/lib/navigation", () => ({
    useParams: () => ({ slug: "acme" }),
    usePathname: () => "/acme/geo/traffic",
    useRouter: () => ({ push: () => undefined }),
  }));
  const { GeoIngestScriptSetup } =
    await import("../src/components/geo/geo-ingest-script-setup");
  const { GeoIngestSetup } =
    await import("../src/components/geo/geo-ingest-setup");
  const { geoScriptSnippet } = await import("../src/utils/geo-ingest");

  const script = {
    url: "https://ingest.example/api/notra.js",
    pinnedUrl: "https://ingest.example/api/notra.0123456789ab.js",
    integrity: "sha384-abc",
  };
  const plus = {
    url: "https://ingest.example/api/notra.plus.js",
    pinnedUrl: "https://ingest.example/api/notra.plus.0123456789ab.js",
    integrity: "sha384-def",
  };
  const setup = {
    webKey: "nwk.key",
    webSnippet: "",
    webScript: script,
    webPlusScript: plus,
    canManage: false,
  } as unknown as DashboardGeoIngestSetup;

  const wrap = (node: React.ReactNode) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <IntlProvider locale="en" messages={messages} timeZone="UTC">
          {node}
        </IntlProvider>
      </QueryClientProvider>
    );
  const render = (value: DashboardGeoIngestSetup | undefined) =>
    wrap(<GeoIngestScriptSetup setup={value} />);
  const text = (html: string) =>
    html
      .replaceAll(/<[^>]+>/g, "")
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">");
  const copy = messages.geo.geoIngestSetup;

  test("the auto-updating notra.js tag is the default, without integrity", () => {
    const html = text(render(setup));
    expect(html).toContain(
      '<script\n  defer\n  src="https://ingest.example/api/notra.js"\n  data-key="nwk.key"\n></script>'
    );
    expect(html).not.toContain("integrity=");
  });

  test("error reporting loads notra.plus.js, and pinning adds the integrity hash", () => {
    expect(geoScriptSnippet(setup, { pinned: false, errors: true })).toBe(
      '<script\n  defer\n  src="https://ingest.example/api/notra.plus.js"\n  data-key="nwk.key"\n></script>'
    );
    expect(geoScriptSnippet(setup, { pinned: true, errors: true })).toBe(
      '<script\n  defer\n  src="https://ingest.example/api/notra.plus.0123456789ab.js"\n  data-key="nwk.key"\n  integrity="sha384-def"\n  crossorigin="anonymous"\n></script>'
    );
    expect(geoScriptSnippet(undefined, { pinned: true, errors: false })).toBe(
      ""
    );
  });

  test("the status waits for the first page view, then says since when", () => {
    firstDay = null;
    expect(text(render(setup))).toContain(copy.script.awaiting);
    firstDay = "2026-10-01";
    const receiving = render(setup);
    expect(text(receiving)).toContain("Receiving page views since Oct 1, 2026");
    expect(receiving).toContain('href="/acme/geo/traffic/web"');
    firstDay = null;
  });

  test("no key means tracking isn't configured, without options or status", () => {
    const html = text(render(undefined));
    expect(html).toContain(copy.script.notConfigured);
    expect(html).not.toContain(copy.script.pinLabel);
    expect(html).not.toContain(copy.script.awaiting);
  });

  test("the card puts the script tag first; only owners and admins can rotate its key", () => {
    const card = (canManage: boolean) =>
      text(
        wrap(
          <GeoIngestSetup
            defaultMethod="script"
            setup={{ ...setup, canManage }}
            variant="settings"
          />
        )
      );
    const member = card(false);
    expect(member.indexOf(copy.methods.script)).toBeLessThan(
      member.indexOf(copy.methods.sdk)
    );
    expect(member).not.toContain(copy.script.rotateKey);
    expect(card(true)).toContain(copy.script.rotateKey);
  });
}
