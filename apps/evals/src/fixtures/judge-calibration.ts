/**
 * Labelled posts for checking the grounding judge (`bun run evals judge-check`).
 * Real posts come from model runs on 2026-11-07 and were labelled by reading
 * them against the scenario sources. Edits change one fact in a grounded base
 * post, so the label is known without review; benign edits add something that
 * must not count against grounding.
 */

export interface CalibrationPost {
  readonly id: string;
  readonly scenarioId: string;
  readonly title: string;
  readonly markdown: string;
  readonly grounded: boolean;
  readonly origin: "real" | "edit" | "benign";
  readonly note: string;
}

type Edit =
  | { readonly replace: string; readonly with: string }
  | { readonly after: string; readonly insert: string };

interface EditSpec {
  readonly id: string;
  readonly base: string;
  readonly edit: Edit;
  readonly note: string;
}

const REAL: readonly Omit<CalibrationPost, "origin">[] = [
  {
    id: "luna-fern-blog",
    scenarioId: "major-release",
    title: "Fern 3 cuts preview boot time from 40 seconds to 8",
    markdown:
      "Fern 3 keeps a pool of warm base containers for `fern up`. On our benchmark repo, median boot time dropped from 40 seconds to 8. Your coffee will get cold slower.\n\nOne compatibility change before you upgrade: Fern 3 no longer supports Docker Compose v1. You need Compose v2. Check your version with `docker compose version`.\n\n## Share a preview with a public URL\n\nRun `fern share` to expose a running preview environment at a public HTTPS URL. The URL expires after 24 hours, which is a reasonable amount of time for someone to review your preview and a short amount of time for a forgotten link to linger.\n\nFern 3 is available now. Upgrade to Docker Compose v2 if needed, then run `fern up` to start a preview or `fern share` to send someone a link.",
    grounded: true,
    note: "Accurate; jokes and an opinion on the 24h expiry. Old judge: 0.65",
  },
  {
    id: "luna-fern-changelog",
    scenarioId: "major-release",
    title: "Fern CLI 3.0 requires Docker Compose v2",
    markdown:
      "Fern CLI 3.0.0 now requires Docker Compose v2; Docker Compose v1 no longer works. Check your installation with `docker compose version` before upgrading. `fern up` now reuses a pool of warm base containers, taking median boot time on the benchmark repo from 40 seconds to 8 seconds. You can also run `fern share` to give a running preview environment a public HTTPS URL that expires after 24 hours. The Compose change is breaking for anyone still on v1, which has been end-of-life since 2023. Upgrade Docker Compose first, then use `fern share` when you need to send someone a preview. The 8-second result is the median on the benchmark repo, not a promise for every project.\n\n## Highlights\n\n### Docker Compose v2 is now required\nFern CLI 3.0 drops Compose v1. Check your installation with `docker compose version` before upgrading. [#401](https://github.com/fern-sh/fern/pull/401) (Author: [@jo](https://github.com/jo/))\n\n### `fern up` boots in 8 seconds on the benchmark repo\nA warm container pool cuts median boot time from 40 seconds to 8 seconds on the benchmark repo. [#398](https://github.com/fern-sh/fern/pull/398) (Author: [@lee](https://github.com/lee/))\n\n## More Updates\n\n### Features & Enhancements\n- **Share a preview environment with `fern share`** [#395](https://github.com/fern-sh/fern/pull/395) - Creates a public HTTPS URL for a running preview environment. The URL expires after 24 hours. (Author: [@lee](https://github.com/lee/))",
    grounded: true,
    note: "Accurate, PR and author links. Old judge: 0.66",
  },
  {
    id: "luna-volumes-tweet",
    scenarioId: "single-fix",
    title: "Fern down removes anonymous volumes",
    markdown:
      "fern down now removes anonymous Docker volumes with the preview env. Already accumulated some? Run `fern prune --volumes` once. On busy machines, those leftovers had reached tens of GB. Docker has a long memory.",
    grounded: true,
    note: "Accurate plus a joke. Old judge: 0.58",
  },
  {
    id: "luna-lumen-changelog",
    scenarioId: "feature-week",
    title: "Export cohorts and track retention drops in Slack",
    markdown:
      "You can export any saved cohort as a CSV or send it to HubSpot as a static list. Exports include user ID, email, first-seen date, and the cohort's defining event counts. HubSpot export requires a connected HubSpot integration. We also added Slack alerts for weekly retention drops. Choose a threshold for each alert; it defaults to 10%. When retention falls past that threshold, Lumen sends the selected Slack channel the cohort name, the drop, and a link to its chart. Funnel date ranges now stay selected when you switch workspaces. Before, Lumen reset them to the last 30 days. Connect HubSpot before exporting there, and adjust the Slack alert threshold if 10% isn't right for your team.\n\n## Highlights\n\n### Export saved cohorts to CSV or HubSpot\nDownload any saved cohort as a CSV, or send it to HubSpot as a static list. HubSpot needs to be connected first. (Author: [@maria](https://github.com/maria/))\n\n### Get Slack alerts when cohort retention drops\nSet a weekly retention drop threshold (10% by default) and choose a Slack channel. Alerts include the cohort, the drop, and a link to its chart. (Author: [@tom](https://github.com/tom/))\n\n## More Updates\n\n### Bug Fixes\n- **Keep funnel date ranges when switching workspaces** - Your selected date range now stays in place instead of resetting to the last 30 days. (Author: [@maria](https://github.com/maria/))",
    grounded: true,
    note: "Accurate, author links. Old judge: 0.73",
  },
  {
    id: "opus-kiwi-blog",
    scenarioId: "german-shop",
    title: "Apple Pay für Shopify-Stores",
    markdown:
      "Wenn du deinen Shop mit unserer Shopify-App betreibst, kannst du ab sofort Apple Pay anbieten. Für Apple Pay fallen keine zusätzlichen Gebühren an.\n\n## So aktivierst du Apple Pay\n\nÖffne das Kiwi Pay Dashboard und geh zu **Zahlungsarten**. Dort schaltest du Apple Pay für deinen Shopify-Store ein.\n\n## Teilerstattungen erstatten Versandkosten nur noch einmal\n\nWir haben außerdem einen Fehler bei Teilerstattungen behoben. Wenn du auf dieselbe Bestellung zwei Teilerstattungen ausgelöst hast, hat Kiwi Pay die Versandkosten zweimal erstattet. Das passiert jetzt nicht mehr. Händler, die betroffen waren, haben wir bereits direkt kontaktiert. Wenn du keine Nachricht von uns bekommen hast, musst du nichts tun.\n\nDetails zur Änderung findest du in [PR #215](https://github.com/kiwipay/checkout/pull/215), die Apple-Pay-Integration in [PR #212](https://github.com/kiwipay/checkout/pull/212).",
    grounded: true,
    note: "Accurate; PR links and a no-action inference from merchants being contacted. Old judge: 0.41",
  },
  {
    id: "opus-fern-blog",
    scenarioId: "major-release",
    title:
      "Fern 3.0 boots preview environments in 8 seconds and adds fern share",
    markdown:
      "Fern 3.0 is out. `fern up` now boots a preview environment in about 8 seconds. It used to take about 40. There is also a new command, `fern share`, that gives a running preview environment a public URL.\n\nOne thing to check before you upgrade: Fern 3.0 requires Docker Compose v2. Support for Compose v1 is gone.\n\n## Breaking: Docker Compose v2 is required\n\nFern no longer works with Docker Compose v1. Compose v1 reached end of life in 2023, and we removed the code that kept it working ([#401](https://github.com/fern-sh/fern/pull/401)). That PR deleted 480 lines and added 120, which is the kind of ratio we like.\n\nTo see which version you have, run:\n\n```sh\ndocker compose version\n```\n\nIf that command fails, or reports v1, upgrade Docker Compose before you install Fern 3.0.\n\n## Warm containers for `fern up`\n\n`fern up` now keeps a pool of warm base containers. A new preview environment starts from one of those instead of a cold container. On our benchmark repo, median boot time dropped from 40s to 8s ([#398](https://github.com/fern-sh/fern/pull/398)).\n\nYou don't need to change anything to get this. Run `fern up` the way you already do.\n\n## Public URLs with `fern share`\n\n`fern share` exposes a running preview environment on a public HTTPS URL ([#395](https://github.com/fern-sh/fern/pull/395)). Send the link to a reviewer, a designer, or whoever asked \"can I see it?\" in the PR thread. They don't need Fern installed.\n\nThe URL expires after 24 hours. If someone needs access after that, run `fern share` again.\n\n## Upgrading\n\n1. Run `docker compose version` and confirm you are on Compose v2.\n2. Install Fern 3.0.\n3. Run `fern up` and time it, if you like that sort of thing.\n\nThe full release notes are on the [v3.0.0 release page](https://github.com/fern-sh/fern/releases/tag/v3.0.0).",
    grounded: true,
    note: "Accurate; diff stats from PR #401, reviewers not needing Fern follows from a public URL. Old judge: 0.43",
  },
  {
    id: "glm-fern-blog",
    scenarioId: "major-release",
    title: "Fern 3.0: preview envs boot in 8 seconds and get public URLs",
    markdown:
      "Fern 3.0 is out. The headline change: `fern up` now starts preview environments from a pool of warm containers, and median boot time on our benchmark repo dropped from 40 seconds to 8. There is also a new `fern share` command that hands a running environment a public HTTPS URL. One thing to check before you upgrade: Docker Compose v1 is no longer supported.\n\n## Preview environments boot in 8 seconds\n\n`fern up` keeps a pool of warm base containers. When you start a preview environment, fern pulls one from the pool instead of building it from a cold start, so the wait shrinks from 40 seconds to 8 (median, measured on our benchmark repo).\n\nThe 8 second figure comes from that repo, so treat it as a benchmark number, not a guarantee for your stack. The mechanism is the same either way: containers wait warm, `fern up` grabs one, your environment starts. Details in [#398](https://github.com/fern-sh/fern/pull/398).\n\n## fern share gives a preview env a public URL\n\nRun `fern share` while an environment is up and fern exposes it on a public HTTPS URL. The URL expires after 24 hours.\n\nThat is long enough to paste a link into a pull request or send it to someone who does not have the repo cloned. It is short enough that dead links expire on their own instead of piling up. Implemented in [#395](https://github.com/fern-sh/fern/pull/395).\n\n## Docker Compose v1 is no longer supported\n\nFern now requires Docker Compose v2. Compose v1 has been end of life since 2023, and dropping it let us remove 480 lines of v1 handling while adding 120, across 14 files ([#401](https://github.com/fern-sh/fern/pull/401)).\n\nCheck what you have before upgrading:\n\n```\ndocker compose version\n```\n\nIf the output says v1, upgrade Docker Compose first, then upgrade fern. This is the only breaking change in the release.\n\n## Where to get it\n\nv3.0.0 is tagged on GitHub ([release notes](https://github.com/fern-sh/fern/releases/tag/v3.0.0)). Update with your usual install method and run `fern share` the next time you want someone to see your environment without cloning anything.",
    grounded: true,
    note: "Accurate; diff stats and file count from PR #401, only breaking change matches the release notes. Old judge: 0.25",
  },
  {
    id: "glm-kiwi-blog",
    scenarioId: "german-shop",
    title: "Apple Pay für Shopify-Shops, Fix für doppelte Rückerstattungen",
    markdown:
      "Apple Pay ist jetzt für Shops verfügbar, die unsere Shopify-App nutzen. Du aktivierst es im Kiwi-Pay-Dashboard unter Zahlungsarten, ohne Aufpreis und ohne eigene Konfiguration bei Shopify.\n\n## Apple Pay in zwei Klicken\n\nWer unseren Shopify-Connector einsetzt, braucht keine Extra-Integration. Du schaltest Apple Pay im Dashboard unter Zahlungsarten frei, und die Zahlungsoption erscheint im Checkout deines Shops. Apple Pay funktioniert nur auf Geräten von Apple (iPhone, iPad, Mac), die Bezahlmethode taucht dort dann automatisch auf, wo Kunden sie erwarten.\n\nEs fallen keine zusätzlichen Gebühren an. Apple Pay läuft zu denselben Konditionen wie deine anderen Zahlungsmethoden.\n\n## Rückerstattungen: Versandkosten werden nicht mehr doppelt erstattet\n\nWir haben einen Fehler in der Teilrückerstattung behoben. Wenn du auf derselben Bestellung zwei Teilrückerstattungen ausgestellt hast, wurden die Versandkosten zweimal zurückerstattet. Kunden erhielten also mehr Geld zurück, als sie bezahlt hatten, und du trugest die Differenz.\n\nDer Fehler ist behoben. Versandkosten werden jetzt nur einmal pro Bestellung erstattet, unabhängig davon, wie viele Teilrückerstattungen du ausstellst. Händler, die von dem Fehler betroffen waren, haben wir direkt kontaktiert.\n\nWenn du in den letzten Wochen Teilrückerstattungen mit Versandkosten ausgestellt hast und unsicher bist, ob es dich betraf: Schau dir die Erstattungen in deinem Dashboard an oder schreib uns, wir prüfen das für dich.\n\n## Was du jetzt tun kannst\n\nNutzt du unsere Shopify-App? Dann aktiviere Apple Pay unter Zahlungsarten im Dashboard. Mehr ist nicht nötig.",
    grounded: false,
    note: "Invents one-tap checkout on iPhone/iPad/Mac, the button appearing automatically and no version to update. Old judge: 0.09",
  },
  {
    id: "glm-volumes-blog",
    scenarioId: "single-fix",
    title: "fern down now deletes the Docker volumes it creates",
    markdown:
      "`fern down` used to leave anonymous Docker volumes behind. On machines running lots of preview environments, those leftovers added up to tens of gigabytes of dead disk. The fix is merged: teardown now removes the volumes along with everything else.\n\n## What was happening\n\nDocker treats any volume not created with an explicit name as anonymous. Fern creates volumes for preview environments without naming them, so `fern down` stopped the containers and removed the environment, but the volumes stayed. Docker never reuses an anonymous volume for a new environment, so every torn-down environment quietly left one behind.\n\nThe fix (PR [#410](https://github.com/fern-sh/fern/pull/410)) is small: teardown now deletes the volumes it created instead of orphaning them.\n\n## Clean up the old ones\n\nThe fix only stops new leaks. If you have been using fern for a while, you probably have a pile of anonymous volumes already. Run this once:\n\n```\nfern prune --volumes\n```\n\nThat removes every anonymous volume fern left behind from earlier teardowns. On a shared dev box that is usually where the real savings are.\n\n## One more thing\n\nIf you run preview environments on a machine with a small disk, this was likely the slow leak you kept chasing. Worth checking `docker volume ls` filtered for anonymous volumes before you run the prune, so you can see what actually gets freed.\n",
    grounded: false,
    note: "Invents how Fern names volumes and that Docker never reuses them. Old judge: 0.40",
  },
  {
    id: "glm-kiwi-changelog",
    scenarioId: "german-shop",
    title: "Apple Pay für Shopify-Shops und ein Fix bei Teilrückerstattungen",
    markdown:
      "Apple Pay ist ab jetzt für alle Shops verfügbar, die unsere Shopify-App nutzen. Du schaltest die Zahlungsart im Dashboard unter Zahlungsarten frei, es fallen keine zusätzlichen Gebühren an. Außerdem haben wir einen Fehler bei Teilrückerstattungen behoben. Wurden auf derselben Bestellung zwei Teilrückerstattungen ausgestellt, haben wir die Versandkosten doppelt erstattet. Das ist korrigiert, betroffene Händler haben wir direkt kontaktiert. Für die Korrektur musst du nichts unternehmen. Wenn du Apple Pay anbieten willst, öffne das Dashboard und aktiviere die Zahlungsart.\n\n## Highlights\n\n### Apple Pay für Shopify-Shops\nShops mit unserer Shopify-App können Apple Pay jetzt im Dashboard unter Zahlungsarten aktivieren. Es fallen keine zusätzlichen Gebühren an. ([#212](https://github.com/kiwipay/checkout/pull/212), Autor: [@lena](https://github.com/lena/))\n\n### Teilrückerstattungen erstatten Versandkosten nicht mehr doppelt\nGab es auf einer Bestellung zwei Teilrückerstattungen, wurden die Versandkosten zweimal erstattet. Der Fehler ist behoben, betroffene Händler haben wir kontaktiert. ([#215](https://github.com/kiwipay/checkout/pull/215), Autor: [@max](https://github.com/max/))\n\nApple Pay findest du im Dashboard unter Zahlungsarten. Wenn bei dir eine doppelte Erstattung von Versandkosten aufgefallen ist und du keinen Kontakt von uns hattest, melde dich bei unserem Support.",
    grounded: true,
    note: "Accurate; no-action inference and a pointer to support. Old judge: 0.31",
  },
  {
    id: "glm-lumen-linkedin",
    scenarioId: "feature-week",
    title: "Cohort exports to HubSpot and CSV",
    markdown:
      "We took cohort exports out of the dashboard.\n\nLast week, the only way to act on a cohort was to look at it in Lumen. Now you can export any saved cohort as a CSV or push it straight to HubSpot as a static list.\n\nNo more copy-pasting rows. Connect the HubSpot integration, pick a cohort, send it over. Exports include user id, email, first seen, and the event counts that define the cohort.\n\nWhile we were in there, we also shipped retention drop alerts to Slack. When a cohort's weekly retention falls more than 10% (the default, you can change it), we post to your channel with a link to the chart.\n\nYour analytics now tell your tools what to do next.\n\nWhich cohort would you push to HubSpot first?",
    grounded: false,
    note: "Invents the prior state: viewing in Lumen was the only way to act on a cohort. Old judge: 0.47",
  },
];

const UNGROUNDED_EDITS: readonly EditSpec[] = [
  {
    id: "edit-fern-boot-number",
    base: "luna-fern-blog",
    edit: { replace: "from 40 seconds to 8", with: "from 40 seconds to 3" },
    note: "Contradicts the 8s median",
  },
  {
    id: "edit-fern-share-expiry",
    base: "luna-fern-blog",
    edit: { replace: "expires after 24 hours", with: "expires after 7 days" },
    note: "Contradicts the 24h expiry",
  },
  {
    id: "edit-fern-podman",
    base: "luna-fern-blog",
    edit: {
      after: "Fern 3 no longer supports Docker Compose v1.",
      insert: " Podman is now supported as an alternative.",
    },
    note: "Invented platform",
  },
  {
    id: "edit-fern-cause",
    base: "luna-fern-blog",
    edit: {
      after: "median boot time dropped from 40 seconds to 8.",
      insert:
        " Most of the old boot time was spent pulling base images from Docker Hub.",
    },
    note: "Invented cause",
  },
  {
    id: "edit-lumen-threshold",
    base: "luna-lumen-changelog",
    edit: { replace: "it defaults to 10%", with: "it defaults to 5%" },
    note: "Contradicts the 10% default",
  },
  {
    id: "edit-lumen-row-cap",
    base: "luna-lumen-changelog",
    edit: {
      after: "the cohort's defining event counts.",
      insert: " Each export is capped at 50,000 users.",
    },
    note: "Invented limit",
  },
  {
    id: "edit-lumen-teams",
    base: "luna-lumen-changelog",
    edit: {
      after: "HubSpot export requires a connected HubSpot integration.",
      insert: " Retention alerts can also go to Microsoft Teams.",
    },
    note: "Invented integration",
  },
  {
    id: "edit-lumen-cause",
    base: "luna-lumen-changelog",
    edit: {
      after: "Before, Lumen reset them to the last 30 days.",
      insert:
        " The reset happened because workspace settings were cached per browser tab.",
    },
    note: "Invented cause",
  },
  {
    id: "edit-volumes-size",
    base: "luna-volumes-tweet",
    edit: { replace: "tens of GB", with: "over 200 GB" },
    note: "Invented number",
  },
  {
    id: "edit-volumes-nightly",
    base: "luna-volumes-tweet",
    edit: {
      after: "Run `fern prune --volumes` once.",
      insert: " Fern now prunes old volumes every night.",
    },
    note: "Invented behaviour",
  },
  {
    id: "edit-kiwi-fee",
    base: "opus-kiwi-blog",
    edit: {
      replace: "Für Apple Pay fallen keine zusätzlichen Gebühren an.",
      with: "Für Apple Pay fällt eine Gebühr von 0,1 % pro Transaktion an.",
    },
    note: "Contradicts no extra fees",
  },
  {
    id: "edit-kiwi-woocommerce",
    base: "opus-kiwi-blog",
    edit: {
      after: "Dort schaltest du Apple Pay für deinen Shopify-Store ein.",
      insert: " Für WooCommerce-Shops ist Apple Pay ebenfalls verfügbar.",
    },
    note: "Invented platform",
  },
];

const BENIGN_EDITS: readonly EditSpec[] = [
  {
    id: "benign-fern-arithmetic",
    base: "luna-fern-blog",
    edit: {
      after: "median boot time dropped from 40 seconds to 8.",
      insert: " That is five times faster.",
    },
    note: "Arithmetic on source numbers",
  },
  {
    id: "benign-fern-public-url",
    base: "luna-fern-blog",
    edit: {
      after:
        "Run `fern share` to expose a running preview environment at a public HTTPS URL.",
      insert: " Anyone with the link can open it.",
    },
    note: "Follows from a public URL",
  },
  {
    id: "benign-lumen-joke",
    base: "luna-lumen-changelog",
    edit: {
      after: "Before, Lumen reset them to the last 30 days.",
      insert: " Your date range now has object permanence.",
    },
    note: "Joke",
  },
  {
    id: "benign-lumen-diff-stats",
    base: "luna-lumen-changelog",
    edit: {
      after: "the cohort's defining event counts.",
      insert: " The export work touched 18 files.",
    },
    note: "PR #812 changedFiles",
  },
  {
    id: "benign-lumen-pr-link",
    base: "luna-lumen-changelog",
    edit: {
      after: "HubSpot export requires a connected HubSpot integration.",
      insert: " Details in [#812](https://github.com/lumen-hq/lumen/pull/812).",
    },
    note: "Link to a source PR",
  },
  {
    id: "benign-volumes-pr-link",
    base: "luna-volumes-tweet",
    edit: {
      after: "Run `fern prune --volumes` once.",
      insert: " https://github.com/fern-sh/fern/pull/410",
    },
    note: "Link to a source PR",
  },
];

function applyEdit(spec: EditSpec, grounded: boolean): CalibrationPost {
  const base = REAL.find((post) => post.id === spec.base);
  if (!base) {
    throw new Error(`Unknown calibration base ${spec.base}`);
  }
  const anchor = "replace" in spec.edit ? spec.edit.replace : spec.edit.after;
  if (!base.markdown.includes(anchor)) {
    throw new Error(`${spec.id}: "${anchor}" not found in ${spec.base}`);
  }
  const markdown =
    "replace" in spec.edit
      ? base.markdown.replace(spec.edit.replace, spec.edit.with)
      : base.markdown.replace(anchor, `${anchor}${spec.edit.insert}`);
  return {
    id: spec.id,
    scenarioId: base.scenarioId,
    title: base.title,
    markdown,
    grounded,
    origin: grounded ? "benign" : "edit",
    note: spec.note,
  };
}

export function calibrationPosts(): CalibrationPost[] {
  return [
    ...REAL.map((post) => ({ ...post, origin: "real" as const })),
    ...UNGROUNDED_EDITS.map((spec) => applyEdit(spec, false)),
    ...BENIGN_EDITS.map((spec) => applyEdit(spec, true)),
  ];
}
