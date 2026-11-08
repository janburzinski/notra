import { afterEach, expect, test } from "bun:test";

import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import { integrationHeadScripts } from "@notra/sites-core/utils/integrations";

import { siteConsent } from "../compiler/utils/consent";

const globals = globalThis as Record<string, unknown>;

async function startCode(hostname: string) {
  Object.assign(globals, {
    __NOTRA_CONSENT_ANALYTICS__: {
      gtag: { id: "G-TEST" },
      posthog: {
        id: "phc_test",
        apiHost: "https://us.i.posthog.com",
        disableSessionRecording: true,
      },
    },
    __NOTRA_HOSTING_DOMAIN__: "notra.site",
    __NOTRA_CONSENT_STORAGE_KEY__: "__Host-c15t",
    location: { hostname },
    document: { cookie: "" },
  });
  const { default: client } = await import(`../src/c15t.client.ts?${hostname}`);
  return client.scripts
    .map(
      (script: {
        serverStart?: (info: unknown, started: unknown) => { code: string };
      }) =>
        script.serverStart?.(
          {
            hasConsent: true,
            elementId: "test",
            consents: { necessary: true, measurement: true },
          },
          script
        )?.code
    )
    .join("\n");
}

afterEach(() => {
  for (const name of [
    "__NOTRA_CONSENT_ANALYTICS__",
    "__NOTRA_HOSTING_DOMAIN__",
    "__NOTRA_CONSENT_STORAGE_KEY__",
    "location",
    "document",
  ]) {
    delete globals[name];
  }
});

test("consent-gated GA4 and PostHog keep their cookies host-only on the hosting domain", async () => {
  const code = await startCode("acme.notra.site");
  expect(code).toContain('["config","G-TEST",{"cookie_domain":"none"}]');
  expect(code).toContain('"cross_subdomain_cookie":false');
});

test("consent-gated GA4 and PostHog keep their defaults on a custom domain", async () => {
  const code = await startCode("blog.acme.com");
  expect(code).toContain('["config","G-TEST"]');
  expect(code).not.toContain("cookie_domain");
  expect(code).not.toContain("cross_subdomain_cookie");
});

test("consent-gated Capless loads its script with the key only after a measurement grant", async () => {
  Object.assign(globals, {
    __NOTRA_CONSENT_ANALYTICS__: {
      capless: {
        key: "cs_abcdefghijklmnop",
        scriptUrl: "https://configured.example/capless.js",
      },
    },
    __NOTRA_HOSTING_DOMAIN__: null,
    __NOTRA_CONSENT_STORAGE_KEY__: "__Host-c15t",
    location: { hostname: "blog.acme.com" },
    document: { cookie: "" },
  });
  const variant = "capless";
  const { default: client } = await import(`../src/c15t.client.ts?${variant}`);
  expect(client.scripts).toEqual([
    {
      id: "capless",
      src: "https://configured.example/capless.js",
      category: "measurement",
      async: true,
      attributes: { "data-key": "cs_abcdefghijklmnop" },
    },
  ]);
});

test("consent-gated Rybbit gets the same script URL and options as the ungated page", async () => {
  const config = siteConfigSchema.parse({
    name: "Acme",
    integrations: {
      c15t: { backendURL: "https://consent.acme.com" },
      rybbit: {
        siteId: "4242",
        scriptUrl: "https://stats.acme.com/api/script.js",
        skipPatterns: ["/drafts/**"],
        debounce: 0,
        replay: {
          maskAllInputs: false,
          sampling: { mouseInteraction: { Click: true } },
        },
      },
    },
  });
  const analytics = siteConsent(
    config,
    [],
    true,
    false,
    "https://blog.acme.com"
  )?.analytics;
  const rybbit = {
    src: "https://stats.acme.com/api/script.js?siteId=4242",
    attributes: {
      "data-skip-patterns": '["/drafts/**"]',
      "data-debounce": "0",
      "data-replay-mask-all-inputs": "false",
      "data-replay-sampling": '{"mouseInteraction":{"Click":true}}',
    },
  };
  expect(analytics?.rybbit).toEqual(rybbit);
  expect(integrationHeadScripts(config.integrations)).toEqual([
    {
      kind: "external",
      src: rybbit.src,
      attributes: { ...rybbit.attributes, defer: true },
    },
  ]);

  Object.assign(globals, {
    __NOTRA_CONSENT_ANALYTICS__: { rybbit },
    __NOTRA_HOSTING_DOMAIN__: null,
    __NOTRA_CONSENT_STORAGE_KEY__: "__Host-c15t",
    location: { hostname: "blog.acme.com" },
    document: { cookie: "" },
  });
  const variant = "rybbit";
  const { default: client } = await import(`../src/c15t.client.ts?${variant}`);
  expect(client.scripts).toEqual([
    {
      id: "rybbit",
      category: "measurement",
      async: true,
      ...rybbit,
    },
  ]);
});

test("consent-gated OneDollarStats gets the same script URL and options as the ungated page", async () => {
  const config = siteConfigSchema.parse({
    name: "Acme",
    integrations: {
      c15t: { backendURL: "https://consent.acme.com" },
      onedollarstats: {
        hostname: "Blog.Acme.com",
        scriptUrl: "https://stats.acme.com/stonks.js",
        collectorUrl: "https://stats.acme.com/events/",
        autocollect: false,
        hashRouting: true,
        props: { section: "blog", tier: " free " },
      },
    },
  });
  const analytics = siteConsent(
    config,
    [],
    true,
    false,
    "https://blog.acme.com"
  )?.analytics;
  const onedollarstats = {
    src: "https://stats.acme.com/stonks.js",
    attributes: {
      "data-hostname": "blog.acme.com",
      "data-autocollect": "false",
      "data-url": "https://stats.acme.com/events",
      "data-props": "section=blog;tier=free",
      "data-hash-routing": "",
    },
  };
  expect(analytics?.onedollarstats).toEqual(onedollarstats);
  expect(integrationHeadScripts(config.integrations)).toEqual([
    {
      kind: "external",
      src: onedollarstats.src,
      attributes: { ...onedollarstats.attributes, defer: true },
    },
  ]);

  Object.assign(globals, {
    __NOTRA_CONSENT_ANALYTICS__: { onedollarstats },
    __NOTRA_HOSTING_DOMAIN__: null,
    __NOTRA_CONSENT_STORAGE_KEY__: "__Host-c15t",
    location: { hostname: "blog.acme.com" },
    document: { cookie: "" },
  });
  const variant = "onedollarstats";
  const { default: client } = await import(`../src/c15t.client.ts?${variant}`);
  expect(client.scripts).toEqual([
    {
      id: "onedollarstats",
      category: "measurement",
      async: true,
      ...onedollarstats,
    },
  ]);
});

test("consent-gated DataFast gets the same script URL and options as the ungated page", async () => {
  const config = siteConfigSchema.parse({
    name: "Acme",
    integrations: {
      c15t: { backendURL: "https://consent.acme.com" },
      datafast: {
        websiteId: "dfid_PvUdM8yOz073w4v9PSwnk",
        domain: "Acme.com",
        allowedHostnames: ["app.acme.io", "shop.acme.io"],
        apiUrl: "https://stats.acme.com/api/events",
        disablePayments: true,
        debug: false,
      },
    },
  });
  const analytics = siteConsent(
    config,
    [],
    true,
    false,
    "https://blog.acme.com"
  )?.analytics;
  const datafast = {
    src: "https://datafa.st/js/script.js",
    attributes: {
      "data-website-id": "dfid_PvUdM8yOz073w4v9PSwnk",
      "data-domain": "acme.com",
      "data-allowed-hostnames": "app.acme.io,shop.acme.io",
      "data-api-url": "https://stats.acme.com/api/events",
      "data-disable-payments": "true",
      "data-debug": "false",
    },
  };
  expect(analytics?.datafast).toEqual(datafast);
  expect(integrationHeadScripts(config.integrations)).toEqual([
    {
      kind: "external",
      src: datafast.src,
      attributes: { ...datafast.attributes, defer: true },
    },
  ]);

  Object.assign(globals, {
    __NOTRA_CONSENT_ANALYTICS__: { datafast },
    __NOTRA_HOSTING_DOMAIN__: null,
    __NOTRA_CONSENT_STORAGE_KEY__: "__Host-c15t",
    location: { hostname: "blog.acme.com" },
    document: { cookie: "" },
  });
  const variant = "datafast";
  const { default: client } = await import(`../src/c15t.client.ts?${variant}`);
  expect(client.scripts).toEqual([
    {
      id: "datafast",
      category: "measurement",
      async: true,
      ...datafast,
    },
  ]);
});

test("consent-gated Simple Analytics gets the same script URL and options as the ungated page", async () => {
  const config = siteConfigSchema.parse({
    name: "Acme",
    integrations: {
      c15t: { backendURL: "https://consent.acme.com" },
      simpleAnalytics: {
        hostname: "Blog.Acme.com",
        scriptUrl: "https://api.acme.com/latest.js",
        collectDnt: false,
        ignorePages: ["/drafts/*", "/search"],
        ignoreMetrics: ["useragent"],
        pings: [5, 60],
      },
    },
  });
  const analytics = siteConsent(
    config,
    [],
    true,
    false,
    "https://blog.acme.com"
  )?.analytics;
  const simpleAnalytics = {
    src: "https://api.acme.com/latest.js",
    attributes: {
      "data-hostname": "blog.acme.com",
      "data-collect-dnt": "false",
      "data-ignore-pages": "/drafts/*,/search",
      "data-ignore-metrics": "useragent",
      "data-pings": "5,60",
    },
  };
  expect(analytics?.simpleAnalytics).toEqual(simpleAnalytics);
  expect(integrationHeadScripts(config.integrations)).toEqual([
    {
      kind: "external",
      src: simpleAnalytics.src,
      attributes: { ...simpleAnalytics.attributes, async: true },
    },
  ]);

  Object.assign(globals, {
    __NOTRA_CONSENT_ANALYTICS__: { simpleAnalytics },
    __NOTRA_HOSTING_DOMAIN__: null,
    __NOTRA_CONSENT_STORAGE_KEY__: "__Host-c15t",
    location: { hostname: "blog.acme.com" },
    document: { cookie: "" },
  });
  const variant = "simple-analytics";
  const { default: client } = await import(`../src/c15t.client.ts?${variant}`);
  expect(client.scripts).toEqual([
    {
      id: "simple-analytics",
      category: "measurement",
      async: true,
      ...simpleAnalytics,
    },
  ]);
});
