import type { Vendor } from "./types";

/**
 * Each tracker is installed the way its docs say, at its real CDN URL, with
 * the request answered from a local cache so runs are offline and repeatable.
 * Features are left at their defaults: that is what a customer gets.
 */
export const VENDORS: Vendor[] = [
  {
    id: "none",
    name: "No tracker (baseline)",
    tag: "",
  },
  {
    id: "notra",
    name: "Notra notra.js (new)",
    url: "https://ingest.usenotra.com/api/notra.js",
    tag: '<script defer src="https://ingest.usenotra.com/api/notra.js" data-key="nwk.bench.bench.0000"></script>',
  },
  {
    id: "notra-plus",
    name: "Notra notra.plus.js (with errors)",
    url: "https://ingest.usenotra.com/api/notra.plus.js",
    tag: '<script defer src="https://ingest.usenotra.com/api/notra.plus.js" data-key="nwk.bench.bench.0000"></script>',
  },
  // Engagement only: Notra Sites count page views on the server.
  {
    id: "notra-sites",
    name: "Notra Sites insights.js (current)",
    url: "https://bench.test/_notra/insights.js",
    tag: '<script defer src="https://bench.test/_notra/insights.js" data-endpoint="/_notra/e"></script>',
  },
  {
    id: "plausible",
    name: "Plausible",
    url: "https://plausible.io/js/script.js",
    tag: '<script defer data-domain="bench.test" src="https://plausible.io/js/script.js"></script>',
  },
  {
    id: "promptwatch",
    name: "PromptWatch",
    url: "https://ingest.promptwatch.com/js/client.min.js",
    tag: '<script defer src="https://ingest.promptwatch.com/js/client.min.js" data-project-id="bench"></script>',
  },
  {
    id: "fathom",
    name: "Fathom",
    url: "https://cdn.usefathom.com/script.js",
    tag: '<script defer src="https://cdn.usefathom.com/script.js" data-site="BENCHXYZ"></script>',
  },
  {
    id: "umami",
    name: "Umami",
    url: "https://cloud.umami.is/script.js",
    tag: '<script defer src="https://cloud.umami.is/script.js" data-website-id="00000000-0000-4000-8000-000000000000"></script>',
  },
  {
    id: "simple-analytics",
    name: "Simple Analytics",
    url: "https://scripts.simpleanalyticscdn.com/latest.js",
    tag: '<script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>',
  },
  {
    id: "databuddy",
    name: "Databuddy",
    url: "https://cdn.databuddy.cc/databuddy.js",
    tag: '<script async src="https://cdn.databuddy.cc/databuddy.js" data-client-id="bench"></script>',
  },
  {
    id: "databuddy-full",
    name: "Databuddy (vitals + errors + links)",
    url: "https://cdn.databuddy.cc/databuddy.js",
    tag: '<script async src="https://cdn.databuddy.cc/databuddy.js" data-client-id="bench" data-track-web-vitals data-track-errors data-track-outgoing-links></script>',
  },
];
