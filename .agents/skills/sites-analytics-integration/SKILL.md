---
name: sites-analytics-integration
description: Checklist and test workflow for adding or changing an analytics provider on Notra Sites (like Databuddy, Rybbit, Umami, Plausible, PostHog, GA4 or Capless). Use it whenever someone asks to add, extend or fix a Sites analytics integration, a tracker script in blog.json `integrations`, its c15t consent loading, its CSP origins, its Sites E2E emulator, its dashboard dialog or its docs page.
---

# Sites analytics integration

A Notra Sites analytics integration is more than a script tag. It is a typed `blog.json` setting, a head script, a c15t consent path, CSP origins, a dashboard dialog in English and German, a Sites E2E emulator and a docs page. All of them have to agree, and the tests have to prove that the browser really sends the provider's requests even though Notra has no account with the provider.

Use the [Databuddy](../../../packages/sites-core/src/schemas/site-integrations.ts) and Rybbit integrations (PR #2392) as the reference. Capless is the counterexample: it exposes a single key and leaves every other tracker option untyped, so don't copy it.

## 1. Gate and research

- Run [dpa-check](../dpa-check/SKILL.md) before anything else, because the DPA is a hard gate. Analytics tools on Sites are customer-enabled and fall under the "Analytics tools on Notra Sites, such as …" row of `apps/web/src/content/legal/subprocessors.mdx`, so they usually need no new row, but the skill decides that, not you.
- Read the provider's real tracker script, not only its docs. Download it into the scratchpad and list what it reads, because docs pages go missing or lag behind (Rybbit's config page was a 404). For example, grep it for `getAttribute("data-…")`, `dataset`, the config object it builds and every `fetch`/`sendBeacon` URL. Note the default of each option, which host it loads assets from and which host it sends events, settings requests and replays to.
- Find out whether the provider sets cookies, uses local storage or has an opt-out key, because the docs page needs that.
- Check whether `@c15t/integrations` ships a helper for the provider (`ls apps/sites-builder/node_modules/@c15t/integrations/dist/vendors/analytics`) and read which attributes it writes. It decides how the consent path loads the script.

## 2. Type every option

The schema work all happens in `packages/sites-core`, starting with the constants.

- Put regexes, limits and default URLs in `src/constants/integrations.ts` as `<PROVIDER>_…` constants.
- Add a `z.strictObject` schema in `src/schemas/site-integrations.ts` that covers **every** option the script reads, with the real type, bounds from the script (for example `Math.max(1000, …)` becomes `.min(1000)`) and a `.describe()` that states what it does and its default. Nested JSON options become nested strict objects with every known key, never `z.record`, `z.unknown()` or a free-form string, so editors autocomplete them and reject typos.
- Encode every constraint in a form that survives JSON Schema export. `.refine()` and `.superRefine()` are dropped from `apps/web/public/schemas/blog.json`, so a check like "must end in `/script.js`" belongs in the regex itself, or the editor accepts a value the build rejects.
- If the provider publishes TypeScript types for its options, tie the schema to them the way `DatabuddySchemaShape` does with `satisfies`.
- Register the schema in `siteIntegrationSchemas`, `siteIntegrationUpdateSchema` and `siteIntegrationsSchema`, and export a `Site<Provider>` type from `src/types/site-integrations.ts`.
- Regenerate the editor schema with `bun run generate:json-schema` in `packages/sites-core`, then run `bun x oxfmt apps/web/public/schemas/blog.json` from the repository root so the diff only contains your change. `tests/json-schema.test.ts` fails when the committed file is stale.

## 3. Render the script once, for both paths

- Write one function in `src/utils/integrations.ts` that turns the settings into `{ src, attributes }`, like `rybbitScript()`. Use `dataAttributes()` for camelCase options, which JSON-encodes arrays, objects, numbers and booleans. Both the plain head script and the consent path call this function, so they can't drift apart.
- Add the provider to `integrationHeadScripts()` and its origins to `integrationCspSources()`. Derive the origins from the configured URLs (self-hosted script, API host) instead of hard-coding the cloud host, and add `connect-src` for every host the script sends to. If the recorder needs a `blob:` worker, extend the `worker-src` condition in `src/utils/content-security-policy.ts`.
- When the c15t banner is on, `apps/sites-builder/compiler/utils/head-scripts.ts` drops the plain head scripts, so the provider must load **only** through c15t:
  - Add the provider to `consentAnalytics()` in `apps/sites-builder/compiler/utils/consent.ts` and to `SiteConsentAnalytics` in `apps/sites-builder/src/types/build-params.ts`.
  - Load it in `apps/sites-builder/src/c15t.client.ts`, and use the official `@c15t/integrations` helper only when it passes every option the current script reads, as Databuddy's does through `configWhenGranted` and `configWhenDenied`. Otherwise add a script entry with `category: "measurement"`, `async: true` and the shared `src` and `attributes`. Rybbit does that because c15t's `rybbitAnalytics` helper writes attributes the current script no longer reads (`data-track-errors`, `data-web-vitals`, `data-session-replay`) and can't pass `tag`, `namespace` or any replay option.
- Add the display name to `SITE_INTEGRATION_NAMES` in `packages/sites-server/src/constants/integrations.ts`.

## 4. Dashboard in English and German

- Add the provider to `SITE_INTEGRATION_PROVIDERS` in `apps/dashboard/src/constants/site-integrations.ts`. Show the required ID and the few options people change most, and leave the rest to `blog.json`. The dialog keeps options it doesn't show when it saves.
- Add a logo component to `packages/ui/src/components/ui/svgs/` that uses `currentColor` or theme classes so it works in light and dark mode, and use the [brand-logos](../brand-logos/SKILL.md) skill to find an official mark.
- Add the required field's path to the empty-value list in `patchConfigValue()` in `apps/dashboard/src/utils/site-design-sections.ts`, so clearing it removes the integration.
- Add translations under `sites.integrationsPage` in **both** `apps/dashboard/messages/en.json` and `apps/dashboard/messages/de.json`: `providers.<id>`, `fields.<id>.<key>` for every field, `fieldErrors.<id>.<key>` for every text field and `fieldDescriptions.<id>.<key>` where a hint helps. German uses the informal "du" and follows the wording of the neighbouring providers.
- Prove that the translations resolve by comparing the flattened key sets of both files and then running a throwaway script in `apps/dashboard` that calls `createTranslator({ locale, messages, namespace: "sites.integrationsPage", onError: (error) => { throw error } })` for every provider field in both locales, the same way `site-integration-dialog.tsx` looks them up, and delete the script afterwards.
- Add the provider to the fixtures and the provider list in `apps/dashboard/src/utils/site-integrations.test.ts`.

## 5. Prove the browser sends the requests

Notra has no account with most providers, so the tests never send data to them. Instead, the Sites E2E suite (`apps/sites-e2e`) intercepts every vendor request in Chromium and answers it locally, which proves that the page loads the script, that the CSP allows it and that the browser sends the expected requests. The rules for changing the suite are in `apps/sites-e2e/README.md#keeping-the-suite-green`.

- Add `apps/sites-e2e/emulators/browser/providers/<id>.ts` and list it in `ANALYTICS_PROVIDERS` in `emulators/browser/index.ts`.
  - Give `settings` real values for **every kind** of option the schema has: arrays, nested objects, `false` and `0`. Pick patterns that don't match fixture pages, so live mode still reports normal page views.
  - The stand-in script in `apps/sites-e2e/fixtures/<id>.js` posts the payload shape of the real script and echoes `{ ...document.currentScript.dataset }`. `assertEmulated` compares that echo to a hard-coded list of expected attribute strings, so the suite fails when an option stops reaching the tag.
  - `isLiveAsset` lets the real script and its assets load from the CDN, `isLiveCollect` catches its collection calls and `isLivePageView` recognises a page view in the real wire format.
  - When the real script fetches its own settings first (Rybbit's `/site/tracking-config/<id>`), answer that request with `answerLive` and an empty or minimal JSON body. Without it, live mode depends on whatever the vendor's server returns for a site ID that isn't yours.
- Add one real-format page view to `LIVE_PAGE_VIEWS` in `tests/constants/analytics.ts` and a case to the custom-event switch in `tests/analytics.test.ts`, so a custom event can never pass as a page view.
- Cover the consent path in `apps/sites-builder/tests/consent-analytics.test.ts`, where you build the consent params with `siteConsent()` from a parsed `blog.json` that sets options, check that they equal what `integrationHeadScripts()` renders and check the script entry c15t gets. If only the plain path is tested, the banner path can silently lose options.
- Add the provider to the integration list in `apps/sites-e2e/README.md`.
- Run the suite in both modes from the repository root:

  ```sh
  bun --no-env-file apps/sites-e2e/src/run.ts --repetitions 1
  bun --no-env-file apps/sites-e2e/src/run.ts --repetitions 1 --vendor-scripts live
  ```

  The first run uses the stand-in scripts and checks the exact payloads and attributes. The second loads the provider's real script from its CDN and checks that it reports every page with the configured ID through the site's CSP, while the collection requests are still answered locally. `Browser request failed …` lines for beacons cut off by the next navigation are expected, and any request to an undeclared vendor host fails the run.

### Optional: a clean sandbox run

To show that the real script works from a clean machine without any provider account, run a single page in an Upstash Box (`@upstash/box`, already a dependency of `apps/sites-builder`). Generate the tag and CSP locally with `integrationHeadScripts()` and `buildSiteContentSecurityPolicy()`, serve them from a small `node:http` server in the box and drive headless Chromium with Playwright. In the test, continue requests for the vendor's script assets and fulfil its settings and collection calls with `context.route`. Then assert the page view, a custom event, masked and skipped paths, replay masking and that the console shows no CSP violations.

Boxes are arm64 Debian without root, so Playwright can't install system libraries. Download them as a normal user and point the browser at them:

```sh
mkdir -p apt/lists/partial apt/cache/archives/partial libs
APTO="-o Dir::State::Lists=$PWD/apt/lists -o Dir::Cache=$PWD/apt/cache -o Debug::NoLocking=1"
apt-get $APTO update
for p in libglib2.0-0 libnspr4 libnss3 libatk1.0-0 libdbus-1-3 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 libxkbcommon0 libasound2 libatspi2.0-0 libxi6 libxrender1 libdrm2 libwayland-server0 libxau6 libxdmcp6 libbsd0 libexpat1 libffi8 libatk-bridge2.0-0 libcups2 libpango-1.0-0 libcairo2 libavahi-common3 libavahi-client3 libharfbuzz0b libfribidi0 libthai0 libdatrie1 libgraphite2-3 libpixman-1-0 libpng16-16 libfontconfig1 libfreetype6 libxshmfence1 libgnutls30 libbrotli1 libxcb-render0 libxcb-shm0; do
  dpkg -s $p >/dev/null 2>&1 || apt-get $APTO download $p || echo "skip $p"
done
for f in *.deb; do dpkg -x "$f" libs; done
npx playwright install --only-shell chromium
LD_LIBRARY_PATH=$PWD/libs/usr/lib/aarch64-linux-gnu PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 node check.mjs
```

Delete the box in a `finally` block, and keep the runner in the scratchpad rather than the repository.

## 6. Docs

- Add `apps/docs/sites/integrations/analytics/<id>.mdx` with the `docolin` frontmatter the other provider pages use. Document every `blog.json` option in a table with its type, limits and default, then the nested options in their own tables, plus how to verify on the live site, how the provider loads with the [c15t banner](../../../apps/docs/sites/integrations/consent/c15t.mdx), what it stores in the browser and how to opt out.
- Add a card and an icon (`apps/docs/images/integrations/<id>.svg`, readable on light and dark backgrounds) to `sites/integrations/analytics/overview.mdx`, the page to the nav in `apps/docs/docs.json`, and rows to `sites/reference/blog-json.mdx`.
- Update the provider lists in `sites/integrations/consent/c15t.mdx`, `sites/previews.mdx` and `sites/custom-scripts.mdx`.
- Edit all new and changed prose with the [unslop skill](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md). Write full sentences in active voice and never use staccato sentences, which means no runs of short choppy sentences and no verbless fragments, including table cells like "Defaults to `500`." that stand alone, which you merge into the sentence before. Its "split dense sentences" rule only applies when ideas are genuinely unrelated. Use no em dashes and no Oxford commas.

## 7. Before the pull request

- Run `bun run check`, the type checks of `packages/sites-core`, `apps/sites-builder`, `apps/dashboard`, `packages/ui`, `packages/sites-server` and `apps/sites-e2e` (`bun --no-env-file run --cwd apps/sites-e2e check-types`), the tests in `packages/sites-core`, the consent and integration tests in `apps/sites-builder`, the dashboard integration tests and both E2E modes.
- Restore `bun.lock` if `bun install` touched it without a dependency change.
- The "Notra Sites preview" check builds a Notra site that reads `apps/web/public/schemas/blog.json` as its own config, so it fails on every PR that regenerates the schema. Check its build log with the Notra `get_site_deployment` tool before treating it as a real failure.
- Open the pull request with the [pr-workflow](../pr-workflow/SKILL.md) skill once everything above passes.

## Checklist

- [ ] dpa-check passed
- [ ] Option list taken from the real script, with defaults and limits
- [ ] Strict schema with every option, constraints in exportable form, registered in all three places, `blog.json` regenerated
- [ ] One render function for the head script and c15t, CSP origins from configured URLs
- [ ] Loads only through c15t when the banner is on, with all options
- [ ] Dashboard provider, logo, empty-value cleanup, `en` and `de` translations resolving
- [ ] E2E provider with every option kind, stand-in echoes `dataset`, live-format page view, custom-event case, consent-path test, README list
- [ ] Emulated and live E2E runs pass
- [ ] Docs page with every option, overview card, nav, references and provider lists, edited with unslop
