import { gateway } from "@notra/ai/gateway";
import { scrapeWebsiteForBrandAnalysis } from "@notra/ai/utils/context-dev";
import { db } from "@notra/db/drizzle";
import { geoSettings, projects } from "@notra/db/schema";
import { generateText, Output } from "ai";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_DISCOVERY_ALIAS_LIMIT,
  GEO_DISCOVERY_CACHE_PREFIX,
  GEO_DISCOVERY_CACHE_TTL_SECONDS,
  GEO_DISCOVERY_COMPETITOR_LIMIT,
  GEO_DISCOVERY_CONVERSATIONS,
  GEO_DISCOVERY_MAX_ALIASES,
  GEO_DISCOVERY_MAX_COMPETITORS,
  GEO_DISCOVERY_MAX_PROMPTS,
  GEO_DISCOVERY_MAX_TOKENS,
  GEO_DISCOVERY_MIN_PROMPTS,
  GEO_WEBSITE_DISCOVERY_MODEL,
  GEO_DISCOVERY_SYSTEM_PROMPT,
  GEO_GAP_TITLE_MAX_LENGTH,
  GEO_PROMPT_MAX_LENGTH,
  GEO_PROMPT_MIN_LENGTH,
  GEO_TRACKED_PROMPT_VOICE,
} from "../constants/geo";
import { geoWebsiteDiscoverySchema } from "../schemas/geo";
import type { DbTransaction } from "../types/db";
import type {
  GeoCompetitorSeed,
  GeoDiscoverWebsiteResult,
  GeoGenerateFromWebsiteResult,
  GeoGeneratedConversation,
  GeoPromptInsert,
  GeoScopeInput,
  GeoWebsiteDiscovery,
} from "../types/geo";
import { geoConversationRules } from "../utils/conversation-generation-prompt";
import { geoEnginesForAudience } from "../utils/geo-model-catalog";
import { readGeoCache, writeGeoCache } from "./cache";
import { competitorKey, normalizeCompetitorDomain } from "./domain";
import { geoSkip } from "./effect";
import { GeoDiscoveryError } from "./errors";
import { invalidateGeoIngestHostsCache } from "./ingest-hosts-cache";
import { toGeoProject } from "./mappers";
import { loadGeoModelCatalog } from "./model-catalog";
import {
  insertPromptsInTransaction,
  reconcileCompetitorsInTransaction,
} from "./programs";
import { ensureGeoProject } from "./projects";
import { startClaimedGeoScanRun } from "./scan-handoff";
import { claimGeoScanRun } from "./scan-status";
import {
  insertGeneratedConversationsIfEmpty,
  normalizeGeneratedConversations,
} from "./sequence-generation";
import { buildBrandTerms, promptMentionsBrand } from "./suggestion-keywords";

const MIN_PROMPT_LENGTH = GEO_PROMPT_MIN_LENGTH;
const MAX_PROMPT_LENGTH = GEO_PROMPT_MAX_LENGTH;

function buildDiscoveryPrompt(url: string, content: string): string {
  const year = new Date().getFullYear();
  return `Website: ${url}

Website content:
"""
${content}
"""

Derive the brand tracking configuration for this company:

1. companyName: the company or product name exactly as it brands itself.
2. aliases: up to ${GEO_DISCOVERY_MAX_ALIASES} alternative spellings that identify this company - product names, the bare domain, and common misspellings. Never include generic words that could refer to anything else.
3. competitors: up to ${GEO_DISCOVERY_MAX_COMPETITORS} real, named products at the SAME product layer that directly replace this product. Return fewer (even zero) rather than inventing competitors. A sponsor, integration, underlying service provider, or adjacent managed SaaS is not a direct competitor merely because it solves a related problem. For an SDK/library, list other SDKs/libraries, not email delivery providers or managed social media APIs/schedulers. For each confident competitor give its name and bare website domain, or null if unsure. Never guess a domain.
4. audienceType: who pays this company, judged by its own buyers and never by the industry it serves. "technical" when the buyers are developers, engineers or AI-native teams who deliberately choose which AI model they use (developer tools, APIs, infrastructure, AI products). "commerce" when consumers find it by searching Google for something to buy, book or visit (online shops, consumer products, restaurants, travel, local businesses and trades). "general" for everyone else (professional services, non-technical B2B, media, education), whose buyers just use whatever model their assistant ships with. Software or services sold to shops, restaurants or other businesses are "general" or "technical", not "commerce": a store builder or an email tool for merchants is "general".
5. prompts: ${GEO_DISCOVERY_MIN_PROMPTS} to ${GEO_DISCOVERY_MAX_PROMPTS} entries, each with a "prompt" and a "title". Stop when you run out of genuinely different buyer problems; a narrow product needs fewer prompts than a broad one.
6. conversations: exactly ${GEO_DISCOVERY_CONVERSATIONS} multi-turn conversations, each with a "name" and "steps" (the messages in order). Follow the conversation rules below.

Before writing prompts, picture the different people who might need this kind of product. Write what they would ask an assistant while still deciding how to solve their problem. They are not asking how to promote the company whose website you read. Draft the messages first; only then write an article title for each one. Never reverse-engineer a message from an SEO title.

Prompt rules:
- ${GEO_TRACKED_PROMPT_VOICE}
- Match the exact job and product layer described on this website. Do not shift to adjacent categories (e.g. from an SDK to its underlying providers), or suggest capabilities and customer problems the site does not support. In particular, don't turn a provider-agnostic email library into a deliverability service or a social API library into a scheduling platform.
- For each draft, ask whether a truthful assistant could recommend this product as a direct answer. If not, replace it. For an email abstraction library, questions only about which delivery provider to buy, spam/SPF setup, or scheduled sending fail this test even if those topics appear on the website. A question about switching providers without rewriting code passes. Do not manufacture needs just because a feature or sponsor is mentioned.
- Do not invent time-sensitive facts about legal deadlines, mandatory formats, prices, product support or release dates. Ask about a requirement without asserting when it takes effect unless the provided site explicitly gives that date and it is still current.
- Mix requests for recommendations with practical problems, tradeoffs and buying constraints. Make each message meaningfully different, not the same question with a different opener or role.
- Before finalizing, group the messages by the actual problem they ask about. Keep at most two about the same problem; replacing a provider name, person's role, stack, or opening phrase does not make a new problem. Use the other slots for distinct jobs this product actually helps with. If the site supports fewer distinct jobs, explore different real constraints on those jobs without repeating the same question.
- Mention a direct competitor only when a real buyer might compare it. If there are none, compare ways to solve the problem instead; never invent a product or compare against the company itself.
- Never mention the company name, product name, domain, or any alias. Not even once. Never copy taglines, feature names, coined terms, or marketing copy from the website. Do not explain what the company is.
- Write every prompt in the language the website's audience speaks (a German website gets German prompts). Never mix languages within a prompt. Do not append "${year}".
- Each prompt must be between ${MIN_PROMPT_LENGTH} and ${MAX_PROMPT_LENGTH} characters.

Title rules:
- The title is the headline of the article that would win this prompt: specific, publishable and in Title Case, following proven formats such as "Best {Category} Tools in ${year}: {Facets} Compared", "Best {Competitor} Alternatives for {Use Case}", "{A} vs {B}: Features, Pricing & Which to Choose", "How to {Task} (Step-by-Step)", or "What Is {Term}? Definition, Examples & How to Measure It".
- Use "${year}" only in ranking or comparison titles, never in how-to or definition titles.
- Write titles in the same language as the prompt and keep each under ${GEO_GAP_TITLE_MAX_LENGTH} characters.

${geoConversationRules("the company")}`;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function unionValues(
  existing: string[],
  extracted: string[],
  limit: number
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of [...existing, ...extracted]) {
    const trimmed = value.trim();
    const key = normalizeKey(trimmed);
    if (!trimmed || seen.has(key) || merged.length >= limit) {
      continue;
    }
    seen.add(key);
    merged.push(trimmed);
  }
  return merged;
}

function buildCompetitorSeeds(
  names: string[],
  discovered: readonly GeoCompetitorSeed[]
): GeoCompetitorSeed[] {
  const domains = new Map<string, string | null>();
  for (const entry of discovered) {
    const domain = entry.domain
      ? normalizeCompetitorDomain(entry.domain)
      : null;
    domains.set(competitorKey(entry.name), domain);
  }
  return names.map((name) => ({
    name,
    domain: domains.get(competitorKey(name)) ?? null,
  }));
}

export const prepareGeoWebsiteGeneration = Effect.fn(
  "geo.generateFromWebsite.prepare"
)(function* (
  discovery: GeoWebsiteDiscovery,
  existingCompanyName?: string,
  existingAliases: string[] = []
) {
  const aliases = unionValues(
    existingAliases,
    discovery.aliases,
    GEO_DISCOVERY_ALIAS_LIMIT
  );
  const companyName = existingCompanyName ?? discovery.companyName;
  const brandTerms = buildBrandTerms({
    companyName: discovery.companyName,
    aliases: [companyName, ...existingAliases, ...discovery.aliases],
  });
  const entries: GeoPromptInsert[] = [];

  for (const entry of discovery.prompts) {
    const prompt = entry.prompt.trim();
    const title = entry.title.trim().slice(0, GEO_GAP_TITLE_MAX_LENGTH);
    if (
      prompt.length < MIN_PROMPT_LENGTH ||
      prompt.length > MAX_PROMPT_LENGTH ||
      promptMentionsBrand(prompt, brandTerms)
    ) {
      continue;
    }
    entries.push({ prompt, title: title.length > 0 ? title : null });
  }

  if (entries.length === 0) {
    return yield* Effect.fail(
      new GeoDiscoveryError({
        message: "Website analysis did not produce any usable prompts",
      })
    );
  }

  const conversations = normalizeGeneratedConversations(
    discovery.conversations,
    brandTerms,
    GEO_DISCOVERY_CONVERSATIONS
  );

  return { aliases, companyName, entries, conversations };
});

const scrapeWebsite = Effect.fn("geo.discover.scrape")(function* (url: string) {
  const result = yield* Effect.tryPromise({
    try: () => scrapeWebsiteForBrandAnalysis(url),
    catch: (cause) =>
      new GeoDiscoveryError({ message: "Failed to scrape the website", cause }),
  });

  if (!result.success) {
    return yield* Effect.fail(new GeoDiscoveryError({ message: result.error }));
  }

  return result.content;
});

const extractDiscovery = Effect.fn("geo.discover.extract")(function* (
  organizationId: string,
  url: string,
  content: string
) {
  const result = yield* Effect.tryPromise({
    try: () =>
      generateText({
        model: gateway(GEO_WEBSITE_DISCOVERY_MODEL, {
          organizationId,
        }),
        providerOptions: { gateway: { tags: ["geo-discovery"] } },
        output: Output.object({ schema: geoWebsiteDiscoverySchema }),
        prompt: buildDiscoveryPrompt(url, content),
        instructions: GEO_DISCOVERY_SYSTEM_PROMPT,
        maxOutputTokens: GEO_DISCOVERY_MAX_TOKENS,
      }),
    catch: (cause) =>
      new GeoDiscoveryError({
        message: "Failed to analyze the website",
        cause,
      }),
  });

  const discovery: GeoWebsiteDiscovery = result.output;
  return discovery;
});

function discoveryCacheKey(organizationId: string, url: string): string {
  return `${GEO_DISCOVERY_CACHE_PREFIX}:${organizationId}:${url}`;
}

export const discoverGeoWebsite = Effect.fn("geo.discoverWebsite")(function* (
  organizationId: string,
  url: string,
  fresh = false
) {
  const cacheKey = discoveryCacheKey(organizationId, url);
  const cached = fresh
    ? null
    : yield* readGeoCache(cacheKey, geoWebsiteDiscoverySchema);
  if (cached) {
    const result: GeoDiscoverWebsiteResult = { url, discovery: cached };
    return result;
  }
  const content = yield* scrapeWebsite(url);
  const discovery = yield* extractDiscovery(organizationId, url, content);
  yield* writeGeoCache(cacheKey, discovery, GEO_DISCOVERY_CACHE_TTL_SECONDS);
  const result: GeoDiscoverWebsiteResult = { url, discovery };
  return result;
});

/**
 * Engines a newly created settings row starts with. Technical brands stay on
 * null so they keep following the default set.
 */
const resolveSeedEngines = Effect.fn("geo.discover.seedEngines")(function* (
  organizationId: string,
  discovery: GeoWebsiteDiscovery
) {
  if (discovery.audienceType === "technical") {
    return null;
  }
  const catalog = yield* loadGeoModelCatalog(organizationId);
  return geoEnginesForAudience(catalog, discovery.audienceType);
});

const persistGeoWebsiteGeneration = Effect.fn(
  "geo.generateFromWebsite.persist"
)(function* (
  tx: DbTransaction,
  organizationId: string,
  projectId: string,
  companyName: string,
  aliases: string[],
  entries: readonly GeoPromptInsert[],
  conversations: readonly GeoGeneratedConversation[],
  discoveredCompetitors: readonly GeoCompetitorSeed[],
  seedEngines: string[] | null
) {
  yield* Effect.tryPromise({
    try: () =>
      tx
        .insert(geoSettings)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          companyName,
          aliases,
          competitors: [],
          // Only a new row is seeded; an existing selection is left alone.
          engines: seedEngines,
          enabled: true,
        })
        .onConflictDoUpdate({
          target: geoSettings.projectId,
          set: { companyName, aliases },
        }),
    catch: (cause) =>
      new GeoDiscoveryError({
        message: "Failed to save GEO settings",
        cause,
      }),
  });

  const competitorOutcome = yield* reconcileCompetitorsInTransaction(
    tx,
    organizationId,
    projectId,
    (current) =>
      buildCompetitorSeeds(
        unionValues(
          current.map((competitor) => competitor.name),
          discoveredCompetitors.map((entry) => entry.name),
          GEO_DISCOVERY_COMPETITOR_LIMIT
        ),
        discoveredCompetitors
      ),
    GEO_DISCOVERY_COMPETITOR_LIMIT
  );
  if (competitorOutcome.status === "limit") {
    return yield* Effect.fail(
      new GeoDiscoveryError({
        message: "Website analysis produced too many competitors",
      })
    );
  }

  const inserted = yield* insertPromptsInTransaction(
    tx,
    organizationId,
    projectId,
    entries
  );

  const conversationsAdded = yield* Effect.tryPromise({
    try: () =>
      insertGeneratedConversationsIfEmpty(
        tx,
        organizationId,
        projectId,
        conversations
      ),
    catch: (cause) =>
      new GeoDiscoveryError({
        message: "Failed to save generated conversations",
        cause,
      }),
  });

  const summary: GeoGenerateFromWebsiteResult = {
    companyName,
    aliases,
    competitors: competitorOutcome.competitors.map(
      (competitor) => competitor.name
    ),
    promptsAdded: inserted.length,
    conversationsAdded,
  };
  return summary;
});

const startGeoScanAfterWebsiteGeneration = Effect.fn(
  "geo.generateFromWebsite.startScan"
)(function* (organizationId: string, projectId: string, scanEnabled: boolean) {
  if (!scanEnabled) {
    return;
  }

  // Take the same atomic claim every other trigger takes, rather than
  // stamping a start blindly. The stamp is what the dashboard reads as
  // "Scanning…", and writing it without owning the slot both lied about a
  // scan that a concurrent trigger is already running and overwrote the
  // token that run needs to release it. Losing the claim means a scan is
  // already in flight for this project — its results are what onboarding
  // is waiting for anyway, so start nothing.
  const claim = yield* claimGeoScanRun(projectId).pipe(
    geoSkip("scan claim failed")
  );
  if (claim) {
    yield* startClaimedGeoScanRun(
      organizationId,
      projectId,
      claim.claimedAt
    ).pipe(
      Effect.catch((error) => {
        console.error(
          "[GEO] Failed to start scan after website generate:",
          error
        );
        return Effect.void;
      })
    );
  }
});

export const generateGeoFromWebsite = Effect.fn("geo.generateFromWebsite")(
  function* (scopeInput: GeoScopeInput, url: string) {
    const organizationId = scopeInput.organizationId;
    const { discovery } = yield* discoverGeoWebsite(organizationId, url, true);

    const projectId = yield* ensureGeoProject(
      scopeInput,
      discovery.companyName
    ).pipe(
      Effect.catchTags({
        GeoDatabaseError: (error) =>
          Effect.fail(
            new GeoDiscoveryError({
              message: "Failed to resolve the project",
              cause: error,
            })
          ),
        GeoProjectCreateFailedError: (error) =>
          Effect.fail(
            new GeoDiscoveryError({
              message: "Failed to create the project",
              cause: error,
            })
          ),
        GeoProjectNotFoundError: (error) =>
          Effect.fail(
            new GeoDiscoveryError({
              message: "Project not found",
              cause: error,
            })
          ),
      })
    );

    const existing = yield* Effect.tryPromise({
      try: () =>
        db.query.geoSettings.findFirst({
          where: eq(geoSettings.projectId, projectId),
        }),
      catch: (cause) =>
        new GeoDiscoveryError({
          message: "Failed to load GEO settings",
          cause,
        }),
    });

    const { aliases, companyName, entries, conversations } =
      yield* prepareGeoWebsiteGeneration(
        discovery,
        existing?.companyName,
        existing?.aliases
      );

    const seedEngines = yield* resolveSeedEngines(organizationId, discovery);

    const summary = yield* Effect.tryPromise({
      try: () =>
        db.transaction((tx) =>
          Effect.runPromise(
            persistGeoWebsiteGeneration(
              tx,
              organizationId,
              projectId,
              companyName,
              aliases,
              entries,
              conversations,
              discovery.competitors,
              seedEngines
            )
          )
        ),
      catch: (cause) =>
        new GeoDiscoveryError({
          message: "Failed to save GEO tracking",
          cause,
        }),
    });

    // Newly created settings default to enabled; an existing disabled row is
    // left alone so we never stamp a scan start that the scan will skip.
    yield* startGeoScanAfterWebsiteGeneration(
      organizationId,
      projectId,
      existing?.enabled ?? true
    );

    return summary;
  }
);

export const createGeoProjectFromWebsite = Effect.fn(
  "geo.projectCreateFromWebsite"
)(function* (
  organizationId: string,
  name: string,
  brandSettingsId: string,
  url: string
) {
  const { discovery } = yield* discoverGeoWebsite(organizationId, url, true);
  const { aliases, companyName, entries, conversations } =
    yield* prepareGeoWebsiteGeneration(discovery);
  const seedEngines = yield* resolveSeedEngines(organizationId, discovery);

  const project = yield* Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        const rows = await tx
          .insert(projects)
          .values({
            id: crypto.randomUUID(),
            organizationId,
            name: name.trim(),
            brandSettingsId,
          })
          .returning();
        const row = rows.at(0);
        if (!row) {
          throw new Error("Project insert returned no row");
        }

        await Effect.runPromise(
          persistGeoWebsiteGeneration(
            tx,
            organizationId,
            row.id,
            companyName,
            aliases,
            entries,
            conversations,
            discovery.competitors,
            seedEngines
          )
        );
        return toGeoProject(row);
      }),
    catch: (cause) =>
      new GeoDiscoveryError({
        message: "Failed to create and configure the project",
        cause,
      }),
  });

  yield* Effect.promise(() =>
    invalidateGeoIngestHostsCache(organizationId, project.id)
  );
  yield* startGeoScanAfterWebsiteGeneration(organizationId, project.id, true);
  return project;
});
