import { db } from "@notra/db/drizzle";
import { geoSettings, members, organizations, users } from "@notra/db/schema";
import {
  GEO_ENGINE_DISPLAY_LABELS,
  GEO_ENGINE_POLICY_EFFECTIVE_AT,
  GEO_ENGINE_POLICY_NEW_ORGS_FROM,
  GEO_LEGACY_DEFAULT_ENGINE_IDS,
} from "@notra/geo-core/constants/geo-engine-policy";
import {
  GEO_MODEL_CATALOG_SEED,
  GEO_MODEL_CATALOG_STATIC,
  GEO_MODEL_PROVIDERS,
} from "@notra/geo-core/constants/geo-model-catalog";
import {
  geoEnginePolicyReplacement,
  isGeoSelfServeEngine,
} from "@notra/geo-core/utils/geo-engine-policy";
import { and, eq, isNull, lt } from "drizzle-orm";

import { sendGeoEngineChangeEmail } from "@/lib/email/send";

const args = process.argv.slice(2);
const send = args.includes("--send");
const onlySlug = args.includes("--org")
  ? args[args.indexOf("--org") + 1]
  : undefined;

const EFFECTIVE_DATE = "Thursday, November 12";
const CODING_AGENT_PREFIXES = [
  "claude-code/",
  "codex/",
  "opencode/",
  "fx/",
  "cursor/",
];
const AFTER_CUTOFF = GEO_ENGINE_POLICY_EFFECTIVE_AT + 1;

const PRODUCT_PREFIXED_PROVIDERS = new Set([
  "claude-code",
  "codex",
  "opencode",
  "fx",
  "cursor",
  "perplexity",
]);
const providerLabels = new Map(
  GEO_MODEL_PROVIDERS.map((provider) => [provider.id, provider.label])
);
const labels = new Map(
  [...GEO_MODEL_CATALOG_SEED, ...GEO_MODEL_CATALOG_STATIC].map((entry) => [
    entry.id,
    PRODUCT_PREFIXED_PROVIDERS.has(entry.provider)
      ? `${providerLabels.get(entry.provider) ?? ""} ${entry.label}`.trim()
      : entry.label,
  ])
);
const readableId = (id: string) =>
  (id.split("/").at(-1) ?? id)
    .split("-")
    .map((word) =>
      word === "gpt" ? "GPT" : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ")
    .replace(/^GPT /, "GPT-");
const labelOf = (id: string) => labels.get(id) ?? readableId(id);
const targetLabelOf = (id: string) =>
  GEO_ENGINE_DISPLAY_LABELS[id] ?? labels.get(id) ?? readableId(id);

let sent = 0;
let failed = 0;
let organizationCount = 0;
const rows = await db
  .select({
    organizationId: geoSettings.organizationId,
    slug: organizations.slug,
    engines: geoSettings.engines,
  })
  .from(geoSettings)
  .innerJoin(organizations, eq(organizations.id, geoSettings.organizationId))
  .where(
    and(
      eq(geoSettings.enabled, true),
      isNull(organizations.suspendedAt),
      lt(organizations.createdAt, new Date(GEO_ENGINE_POLICY_NEW_ORGS_FROM))
    )
  );

const enginesByOrg = new Map<string, { slug: string; engines: Set<string> }>();
for (const row of rows) {
  if (onlySlug && row.slug !== onlySlug) {
    continue;
  }
  const entry = enginesByOrg.get(row.organizationId) ?? {
    slug: row.slug,
    engines: new Set<string>(),
  };
  const engines = row.engines?.length
    ? row.engines
    : [...GEO_LEGACY_DEFAULT_ENGINE_IDS];
  for (const engine of engines) {
    entry.engines.add(engine);
  }
  enginesByOrg.set(row.organizationId, entry);
}

for (const [organizationId, { slug, engines }] of enginesByOrg) {
  const changes = [...engines]
    .filter((engine) => !isGeoSelfServeEngine(engine))
    .map((engine) => {
      const to = geoEnginePolicyReplacement(engine, AFTER_CUTOFF);
      return { from: labelOf(engine), to: to ? targetLabelOf(to) : null };
    });
  const codingAgents = [...engines].some((engine) =>
    CODING_AGENT_PREFIXES.some((prefix) => engine.startsWith(prefix))
  );
  const owners = await db
    .select({ name: organizations.name, email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(
      and(eq(members.organizationId, organizationId), eq(members.role, "owner"))
    );
  const organizationName = owners[0]?.name ?? slug;
  const ownerEmails = owners.map((owner) => owner.email);

  console.log(
    `${organizationName} (${slug}) -> ${ownerEmails.join(", ") || "no owner"} [${codingAgents ? "coding agents" : "standard"}]`
  );
  for (const change of changes) {
    console.log(`    ${change.from} -> ${change.to ?? "no longer tracked"}`);
  }
  if (!send) {
    continue;
  }
  for (const recipientEmail of ownerEmails) {
    const result = await sendGeoEngineChangeEmail({
      recipientEmail,
      organizationName,
      organizationSlug: slug,
      effectiveDate: EFFECTIVE_DATE,
      changes,
      codingAgents,
    });
    if (result.error) {
      failed += 1;
      console.error(
        `    failed for ${recipientEmail}: ${result.error.message}`
      );
    } else {
      sent += 1;
    }
  }
}
organizationCount = enginesByOrg.size;
console.log(
  send
    ? `Sent ${sent}, failed ${failed}, organizations ${organizationCount}.`
    : `Dry run: ${organizationCount} organizations. Add --send to send.`
);
process.exit(failed > 0 ? 1 : 0);
