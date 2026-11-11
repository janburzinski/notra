# GEO ingest and journey attribution

How AI traffic flows from a customer's site into the journeys you see on the GEO dashboard.

## The pipeline

```
customer middleware (@usenotra/sdk)          ai-traffic-ingest service (Bun)
  every GET page request                       POST /api/geo/ingest
  -> request envelope ------------------------> token auth (orgId.hmac bearer)
     url, ip, geo headers, referer,            allowlist host (brand + extras)
     user agent, accept-language               classify visitor
     (no body, no cookies)                     resolve journey id
                                               -> Tinybird geo_traffic_events
```

The ingest route is a thin adapter: every step (auth, rate limit, payload validation, event build, Tinybird write) is an Effect composed into one program in `pipeline.ts` (`runGeoIngest`), and each way it can fail is a tagged error in `errors.ts`. `handler.ts` runs the program with `Effect.result` and maps the failure channel to a status in `response.ts`. The pipeline takes a standard `Request`, a background-task scheduler, and an optional write buffer (`batcher.ts`). Bun tracks pending tasks until shutdown; the dashboard's compatibility route uses `afterResponse`.

Deployment and endpoint migration are documented in `apps/ai-traffic-ingest/README.md`, including Unkey Compute setup. Without `GEO_INGEST_URL`, the dashboard still executes the shared pipeline locally. Setting that variable forwards the old endpoint to the dedicated service and gives new installs its URL. The SDK's stable default is `https://ingest.usenotra.com`; changing the provider behind that domain needs no customer endpoint change. Tracking-token authentication, Redis limits and Tinybird writes remain in this pipeline, not a gateway API-key policy.

A valid token is not enough to write an event. After the URL parses, ingest loads the project's brand website plus `geo_settings.domains` and drops the request (same silent 202 as an untracked visitor) when the host is not on that list. Legacy org-scoped tokens use only the oldest project's hosts; other projects need their own tokens. An empty allowlist drops everything. A host lookup outage fails open for project tokens, but returns an error for legacy org tokens to avoid attributing sibling traffic to the oldest project. Saving GEO settings clears the cached allowlist immediately. The token stays an HMAC of org/project/generation — binding hosts in the signature would rotate on every settings edit.

The SDK is deliberately dumb: it forwards a neutral envelope and never classifies anything. All intelligence lives here, so signature updates ship instantly without customers bumping a package.

## Classification (`classify-visitor.ts`)

Per event, in order:

1. User agent matches an AI signature (`@usenotra/sdk/classify`) -> `crawler`, with the signature's agent, category (`training-crawler` | `search-index` | `assistant-browse`), and confidence.
2. Referer host matches an AI assistant domain (chatgpt.com, perplexity.ai, claude.ai, ...) -> `ai_referral`, source = that assistant. This is a human who clicked out of an AI answer.
3. Otherwise -> `human` (normal browser) or `unknown`.

## Journey ids (`journey.ts`)

A journey id groups requests belonging to one agent session. Two kinds, distinguishable by prefix:

### `n_<id>` — explicit tag (precise)

Customers serving Markdown to agents rewrite internal links with `?ntr=<id>` (`tagMarkdownLinks` in `@usenotra/sdk/markdown`). An agent arriving without a tag gets a fresh random id minted into the links it is served; every link it follows carries that id back to us. Properties:

- Exact per-operator journeys: five parallel Claude Code instances get five ids, even behind one NAT or a shared provider pool.
- Survives citation: when an assistant later cites a tagged URL to a human, the click carries the id, linking the human visit to the crawl that caused it. This is also the planned conversion-attribution hook.
- Content-derived, random, zero personal data. The `ntr` param is stripped before storage; stored paths are always clean.

### `f_<hash>` — fingerprint (fuzzy fallback)

For untagged traffic, computed ONLY for `crawler`-classified events (no journey fingerprint is computed for humans):

```
HMAC-SHA256(secret + "|" + utcDay, source + "|" + ipKey + "|" + timeBucket)[:16]
```

- Keyed with the ingest secret plus a daily-rotating date component: irreversible without the secret, unlinkable across days. Raw IPs are never stored anywhere.
- Category-tuned granularity (`toTuning`):
  - `assistant-browse` (ChatGPT-User etc.): full IP + 10-minute bucket. These are short one-user browse sessions from provider pools; a tight window keeps different users' sessions apart.
  - everything else (GPTBot-style crawls): IP /24 (v4) or first 4 groups (v6) + 30-minute bucket. Crawls hop IPs within a range; coarse keys keep one sweep together.
- Known limits: same-window collisions behind one egress IP, and no linkage across buckets. That is the honest ceiling without provider cooperation; the `n_` layer exists to beat it.

## Privacy posture (why legal is fine with this)

Server-side observation only (no device access, so no consent banner under ePrivacy), legitimate-interest basis, raw IP transient, journey fingerprints salted + rotating + crawler-only, identifiers expire in minutes.

Human visitors are only counted from notra.js. Notra Sites serve it from their own origin and relay its beacons to ingest with the site token (`type: "beacon"`, with the page view's request rebuilt by the Site: public URL, client IP, country, user agent); their own server-side reports only record AI traffic. A relayed beacon writes no AI traffic event, since the Site's server-side report of the same request already did, except behind a cookie banner: there the Site marks relays `visitorConsent: true` (notra.js only runs after the grant), its server reports leave AI referrals to them, and a visitor who allows measurement on the landing page still counts as one AI referral. Relays from a proxied Site (`proxied: true`) use the shared network bucket, because their client IP comes from the customer's proxy. 404 pages post with `?s=404`, so missing pages keep their status. Visitors are counted with a visitor id of `HMAC-SHA256(dailySalt, scope + "|" + ip + "|" + userAgent)`. The salt is random per UTC day, shared through Redis and deleted after 48 hours (without Redis, each replica keeps a random salt in memory for that UTC day; it is never derived from the ingest secret), so a visitor id cannot link a visitor across days or sites. No visitor id is computed and no web page view is stored when the ingest secret is unset. Visits sent with `visitorConsent: false` are not counted, and AI referral clicks from those visitors are dropped. notra.js beacons never carry `visitorConsent`: the script is cookieless and stores nothing on the device, so its page views and AI referrals are counted like a server-side request. AI referral rows in `geo_traffic_events` never store the user agent.

A notra.js beacon is an outbound link click (`o`), an error from `notra.plus.js` (`x`, `xs`, `xl`), engagement with web vitals (`t`, `s`, `c`, `i`, `l`, `f`, `b`) or a page view (`r`), checked in that order in `runWebBeacon` (`pipeline.ts`), which public keys (`collect.ts`) and Site relays share. Page views store the view id and the primary `Accept-Language` subtag. Outbound clicks and errors go through the same web rate limit, host allowlist, site mounts and user-agent checks as page views, including the headless and Lighthouse filter; `web_events` stores each click as `Outbound` with the link's host and path only (no query, ids in the path replaced, emails scrubbed), and `web_errors` stores messages scrubbed of URL queries, emails, long digit runs and hex tokens, never a stack. Both keep 90 days, like the other raw web datasources, and are purged with them.

## Where data lands

`geo_traffic_events` (Tinybird): org, timestamp, visitor_type, source, agent, category, confidence, path, host, method, referer, ua, country, language, request id, journey_id. Queried by the `geo_traffic_*` pipes (overview, timeseries, pages, log, journeys) through the Redis-cached client in `@notra/analytics`.
