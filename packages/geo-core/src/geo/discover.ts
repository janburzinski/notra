import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import { gateway } from "@notra/ai/gateway";
import { scrapeWebsiteForBrandAnalysis } from "@notra/ai/utils/context-dev";
import { db } from "@notra/db/drizzle";
import { geoProducts, geoSettings, projects } from "@notra/db/schema";
import { bumpGeoCheckGeneration } from "@notra/db/utils/geo-check-cache";
import { generateText, Output } from "ai";
import { asc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_DISCOVERY_ALIAS_LIMIT,
  GEO_DISCOVERY_CACHE_TTL_SECONDS,
  GEO_DISCOVERY_COMPETITOR_LIMIT,
  GEO_MAX_COMPETITORS,
  GEO_DISCOVERY_CONVERSATIONS,
  GEO_DISCOVERY_MAX_ALIASES,
  GEO_DISCOVERY_MAX_COMPETITORS,
  GEO_DISCOVERY_MAX_PRODUCTS,
  GEO_DISCOVERY_MAX_PROMPTS,
  GEO_DISCOVERY_MAX_TOKENS,
  GEO_DISCOVERY_MIN_PROMPTS,
  GEO_WEBSITE_DISCOVERY_MODEL,
  GEO_DISCOVERY_SYSTEM_PROMPT,
  GEO_GAP_TITLE_MAX_LENGTH,
  GEO_PROMPT_MAX_LENGTH,
  GEO_PROMPT_MIN_LENGTH,
  GEO_PRODUCT_NAME_MAX_LENGTH,
  GEO_PRODUCTS_MAX,
  GEO_PRODUCT_NICHE_MAX_LENGTH,
} from "../constants/geo";
import { geoWebsiteDiscoverySchema } from "../schemas/geo";
import type { DbTransaction } from "../types/db";
import type {
  GeoCompetitorSeed,
  GeoDiscoveredProduct,
  GeoDiscoveredPromptInsert,
  GeoDiscoverWebsiteResult,
  GeoGenerateFromWebsiteResult,
  GeoScopeInput,
  GeoWebsiteDiscovery,
  GeoWebsiteGenerationWrite,
} from "../types/geo";
import { geoConversationRules } from "../utils/conversation-generation-prompt";
import { geoDiscoveryCacheKey } from "../utils/geo-discovery-cache";
import { trackedGeoLanguages } from "../utils/geo-language-rows";
import { logGeoFailure } from "../utils/geo-log";
import { geoEnginesForAudience } from "../utils/geo-model-catalog";
import { startAgentReadinessScanBestEffort } from "./agent-readiness";
import { readGeoCache, writeGeoCache } from "./cache";
import { competitorKey, normalizeCompetitorDomain } from "./domain";
import { geoDb, geoSkip } from "./effect";
import { GeoDiscoveryError } from "./errors";
import { invalidateGeoIngestHostsCache } from "./ingest-hosts-cache";
import { toGeoProject } from "./mappers";
import { loadGeoModelCatalog } from "./model-catalog";
import { sortPromptsIntoProductsQuietly } from "./product-sort";
import {
  insertPromptsInTransaction,
  reconcileCompetitorsInTransaction,
} from "./programs";
import { ensureGeoProject, resolveGeoScope } from "./projects";
import { startClaimedGeoScanRun } from "./scan-handoff";
import { claimGeoScanRun } from "./scan-status";
import {
  insertGeneratedConversationsIfEmpty,
  normalizeGeneratedConversations,
} from "./sequence-generation";
import { buildBrandTerms, promptMentionsBrand } from "./suggestion-keywords";
import { geoTransaction } from "./transaction";

export function buildDiscoveryPrompt(
  url: string,
  content: string,
  language: string,
  existingProducts: readonly string[] = []
): string {
  const year = new Date().getFullYear();
  const keepNames =
    existingProducts.length > 0
      ? ` This project already tracks: ${existingProducts.map((name) => `"${name}"`).join(", ")}. When one of these still fits, copy its name exactly; add a new name only for something none of them covers.`
      : "";
  return `Website: ${url}

Website content:
"""
${content}
"""

Return:
- companyName: the name used on the site.
- aliases: up to ${GEO_DISCOVERY_MAX_ALIASES} specific names, spellings or domains for this company. No generic terms.
- competitors: up to ${GEO_DISCOVERY_MAX_COMPETITORS} real products that replace this one. An integration, sponsor or underlying provider is not a competitor. For an SDK, list other SDKs, not the services it connects to. Include a bare domain only when sure; otherwise use null. Zero competitors is fine.
- audienceType: "technical" for developer tools, APIs, infrastructure and AI products bought by technical teams; "commerce" for products or services consumers buy, book or visit; "general" for other buyers. Classify the buyer, not the industry they serve. Software sold to shops is not "commerce".
- products: 1 to ${GEO_DISCOVERY_MAX_PRODUCTS} things this company sells that a buyer would look for on their own, main one first. Separate apps or product lines count. One product that serves clearly different buyers or jobs may be split into niches. Give each a "name" and a "niche": who it is for and the job it does, in under 15 plain words. A company with one product and one audience lists one entry.
  Use the exact name the site gives the product or product line, such as a model or app name, not a category you describe. A shop lists its main named product lines; never audience segments (men, women, kids), collections, sizes or sales. Plans and tiers (Pro, Teams, Enterprise), add-ons, accessories and single features do not count.${keepNames}
- prompts: ${GEO_DISCOVERY_MIN_PROMPTS} to ${GEO_DISCOVERY_MAX_PROMPTS} distinct buyer questions, each with a "prompt", "title", "product" (a name from your products list, copied exactly) and "intent". Fewer is fine for a narrow product.
- conversations: exactly ${GEO_DISCOVERY_CONVERSATIONS} conversations with a "name" and ordered "steps". Follow the rules below.

Write questions someone would actually type into ChatGPT before finding this company. Use their words, not SEO phrases. Ask for options or a way forward; a complaint alone is not enough. Write questions before titles.
- Start with 2 short questions for 6 or 7 prompts, or 3 or 4 for 8 to 10. Keep them around 40 to 90 characters, each about a specific need this product solves. Write a similar number around 90 to 170 characters with one useful detail. Use the remaining slots for longer questions when buyers have real constraints to explain. Don't add a backstory to fill space.
- Stay at this product's level. A provider-agnostic email library can answer questions about switching or using multiple providers, not which provider to buy, how to fix deliverability or how to schedule sends. A social SDK is not a post scheduler. If this product would not be a direct answer, replace the question.
- Cover different jobs. No more than two questions about the same problem; changing the provider, role or opener does not make a new question. Mix recommendations with practical questions and tradeoffs.
- Never name this company, its products, aliases or domain in a prompt. Do not copy its wording. Mention a direct competitor only when a buyer would naturally compare it.
- Write every prompt in ${language}, even when the website uses another language. Do not invent claims about prices, legal deadlines, features or release dates. Each prompt must be ${GEO_PROMPT_MIN_LENGTH} to ${GEO_PROMPT_MAX_LENGTH} characters; do not append "${year}".

Spread the questions across the products. Give the main product the most; every product gets at least one "problem" question, and one "list" or "comparison" question when slots allow. Do not add questions to cover more products; the count rules above still apply.
Intent:
- "problem": the person describes their situation or symptom and asks what to do, without naming a product type. The product should be a good answer, e.g. "my laptop gets loud and hot on every video call, what can I do about it".
- "list": asks for options or a recommendation in the product's category.
- "comparison": weighs named competitors of that product against each other, or asks for an alternative to one.
- "how_to": asks how to get a specific job done that the product does.

Give each question a useful article title in ${language}, under ${GEO_GAP_TITLE_MAX_LENGTH} characters. Use natural capitalization for that language. Only ranking or comparison titles may include "${year}".

${geoConversationRules("the company", language)}`;
}

function discoveredProducts(
  products: GeoWebsiteDiscovery["products"]
): GeoDiscoveredProduct[] {
  const seen = new Set<string>();
  const result: GeoDiscoveredProduct[] = [];
  for (const product of products) {
    const name = product.name.trim().slice(0, GEO_PRODUCT_NAME_MAX_LENGTH);
    const key = name.toLowerCase();
    if (name.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const niche = product.niche.trim().slice(0, GEO_PRODUCT_NICHE_MAX_LENGTH);
    result.push({ name, niche: niche.length > 0 ? niche : null });
  }
  return result;
}

/**
 * Upserts discovered products by name and returns name to id. Existing
 * products keep their id so prompts that already point at them stay linked.
 */
async function upsertDiscoveredProducts(
  tx: DbTransaction,
  organizationId: string,
  projectId: string,
  products: readonly GeoDiscoveredProduct[]
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (products.length === 0) {
    return ids;
  }
  const existing = await tx
    .select({ name: geoProducts.name })
    .from(geoProducts)
    .where(eq(geoProducts.projectId, projectId));
  const existingNames = new Map(
    existing.map((row) => [row.name.toLowerCase(), row.name])
  );
  // Existing products are always reused; new ones only fill the room left
  // under GEO_PRODUCTS_MAX, like products added by hand.
  let room = GEO_PRODUCTS_MAX - existing.length;
  const kept = products.flatMap((product, position) => {
    const known = existingNames.get(product.name.toLowerCase());
    if (!known) {
      if (room <= 0) {
        return [];
      }
      room -= 1;
    }
    return [{ product, name: known ?? product.name, position }];
  });
  if (kept.length === 0) {
    return ids;
  }
  const values = kept.map(({ product, name, position }) => ({
    id: crypto.randomUUID(),
    organizationId,
    projectId,
    name,
    niche: product.niche,
    position,
  }));
  const rows = await tx
    .insert(geoProducts)
    .values(values)
    .onConflictDoUpdate({
      target: [geoProducts.projectId, geoProducts.name],
      set: { niche: sql`excluded.niche` },
    })
    .returning({ id: geoProducts.id, name: geoProducts.name });
  const idsByName = new Map(rows.map((row) => [row.name, row.id]));
  // Products left out for lack of room get no id; their prompts stay unfiled.
  for (const { product, name } of kept) {
    const id = idsByName.get(name);
    if (id) {
      ids.set(product.name, id);
    }
  }
  return ids;
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
    const key = competitorKey(trimmed);
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

const prepareGeoWebsiteGeneration = Effect.fn(
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
  const products = discoveredProducts(discovery.products);
  const productNames = new Map(
    products.map((product) => [product.name.toLowerCase(), product.name])
  );
  const entries: GeoDiscoveredPromptInsert[] = [];

  for (const entry of discovery.prompts) {
    const prompt = entry.prompt.trim();
    const title = entry.title.trim().slice(0, GEO_GAP_TITLE_MAX_LENGTH);
    if (
      prompt.length < GEO_PROMPT_MIN_LENGTH ||
      prompt.length > GEO_PROMPT_MAX_LENGTH ||
      promptMentionsBrand(prompt, brandTerms)
    ) {
      continue;
    }
    entries.push({
      prompt,
      title: title.length > 0 ? title : null,
      intent: entry.intent ?? null,
      productName: entry.product
        ? (productNames.get(entry.product.trim().toLowerCase()) ?? null)
        : null,
    });
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

  return { aliases, companyName, products, entries, conversations };
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
  content: string,
  language: string,
  existingProducts: readonly string[]
) {
  const result = yield* Effect.tryPromise({
    try: () =>
      generateText({
        model: gateway(GEO_WEBSITE_DISCOVERY_MODEL, {
          organizationId,
        }),
        providerOptions: { gateway: { tags: ["geo-discovery"] } },
        output: Output.object({ schema: geoWebsiteDiscoverySchema }),
        prompt: buildDiscoveryPrompt(url, content, language, existingProducts),
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

export const discoverGeoWebsite = Effect.fn("geo.discoverWebsite")(function* (
  organizationId: string,
  url: string,
  fresh = false,
  language: string = DEFAULT_LANGUAGE,
  existingProducts: readonly string[] = []
) {
  const cacheKey = geoDiscoveryCacheKey(organizationId, url, language);
  const cached = fresh
    ? null
    : yield* readGeoCache(cacheKey, geoWebsiteDiscoverySchema);
  if (cached) {
    const result: GeoDiscoverWebsiteResult = { url, discovery: cached };
    return result;
  }
  const content = yield* scrapeWebsite(url);
  const discovery = yield* extractDiscovery(
    organizationId,
    url,
    content,
    language,
    existingProducts
  );
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
)(function* (tx: DbTransaction, input: GeoWebsiteGenerationWrite) {
  const {
    organizationId,
    projectId,
    companyName,
    aliases,
    products,
    entries,
    conversations,
    discoveredCompetitors,
    seedEngines,
    seedLanguages,
    trackingEnabled,
  } = input;
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
          engines: seedEngines,
          languages: seedLanguages ? [...seedLanguages] : null,
          promptLanguage: seedLanguages?.at(0) ?? null,
          enabled: trackingEnabled,
        })
        .onConflictDoUpdate({
          target: geoSettings.projectId,
          set: {
            companyName,
            aliases,
            autoPrompts: null,
            updatedAt: new Date(),
          },
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
          Math.max(current.length, GEO_DISCOVERY_COMPETITOR_LIMIT)
        ),
        discoveredCompetitors
      ),
    GEO_MAX_COMPETITORS
  );
  if (competitorOutcome.status === "limit") {
    return yield* Effect.fail(
      new GeoDiscoveryError({
        message: "Website analysis produced too many competitors",
      })
    );
  }

  const productIds = yield* Effect.tryPromise({
    try: () =>
      upsertDiscoveredProducts(tx, organizationId, projectId, products),
    catch: (cause) =>
      new GeoDiscoveryError({ message: "Failed to save products", cause }),
  });

  const inserted = yield* insertPromptsInTransaction(
    tx,
    organizationId,
    projectId,
    entries.map(({ productName, ...entry }) => ({
      ...entry,
      productId: productName ? (productIds.get(productName) ?? null) : null,
    }))
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
  const readiness = startAgentReadinessScanBestEffort({
    organizationId,
    projectId,
  });
  if (!scanEnabled) {
    return yield* readiness;
  }

  const scan = Effect.gen(function* () {
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
          logGeoFailure(
            "geo.discover.scan_start_failed",
            "Failed to start scan after website generate",
            error,
            { projectId }
          );
          return Effect.void;
        })
      );
    }
  });
  yield* Effect.all([readiness, scan], { concurrency: "unbounded" });
});

const loadExistingSettings = (projectId: string) =>
  Effect.tryPromise({
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

/** Product names already tracked, so a re-run keeps the same folders. */
const loadExistingProductNames = (projectId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ name: geoProducts.name })
        .from(geoProducts)
        .where(eq(geoProducts.projectId, projectId))
        .orderBy(asc(geoProducts.position), asc(geoProducts.createdAt));
      return rows.map((row) => row.name);
    },
    catch: (cause) =>
      new GeoDiscoveryError({
        message: "Failed to load products",
        cause,
      }),
  });

export const generateGeoFromWebsite = Effect.fn("geo.generateFromWebsite")(
  function* (scopeInput: GeoScopeInput, url: string) {
    const organizationId = scopeInput.organizationId;
    const scope = yield* resolveGeoScope(scopeInput).pipe(
      Effect.mapError(
        (cause) =>
          new GeoDiscoveryError({
            message: "Failed to resolve the project",
            cause,
          })
      )
    );
    const existing = scope.projectId
      ? yield* loadExistingSettings(scope.projectId)
      : undefined;
    const existingProducts = scope.projectId
      ? yield* loadExistingProductNames(scope.projectId)
      : [];
    const { discovery } = yield* discoverGeoWebsite(
      organizationId,
      url,
      true,
      existing?.promptLanguage ?? DEFAULT_LANGUAGE,
      existingProducts
    );

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

    const { aliases, companyName, products, entries, conversations } =
      yield* prepareGeoWebsiteGeneration(
        discovery,
        existing?.companyName,
        existing?.aliases
      );

    const seedEngines = yield* resolveSeedEngines(organizationId, discovery);

    const summary = yield* geoTransaction("save GEO tracking failed", (tx) =>
      persistGeoWebsiteGeneration(tx, {
        organizationId,
        projectId,
        companyName,
        aliases,
        products,
        entries,
        conversations,
        discoveredCompetitors: discovery.competitors,
        seedEngines,
        seedLanguages: null,
        trackingEnabled: true,
      })
    ).pipe(
      Effect.catchTag("GeoDatabaseError", (cause) =>
        Effect.fail(
          new GeoDiscoveryError({
            message: "Failed to save GEO tracking",
            cause,
          })
        )
      )
    );
    // Cached aggregates group by the brand names saved above.
    yield* Effect.promise(() => bumpGeoCheckGeneration([organizationId]));

    yield* sortPromptsIntoProductsQuietly(organizationId, projectId);

    yield* startGeoScanAfterWebsiteGeneration(
      organizationId,
      projectId,
      existing?.enabled ?? true
    );

    return summary;
  }
);

/** Discovery shared by creating a project and setting up GEO on one. */
const discoverProjectSeed = Effect.fn("geo.projectSeed")(function* (
  organizationId: string,
  url: string,
  languages: readonly string[] | undefined
) {
  const seedLanguages = languages?.length
    ? trackedGeoLanguages(languages)
    : null;
  const { discovery } = yield* discoverGeoWebsite(
    organizationId,
    url,
    true,
    seedLanguages?.at(0) ?? DEFAULT_LANGUAGE
  );
  const generation = yield* prepareGeoWebsiteGeneration(discovery);
  const seedEngines = yield* resolveSeedEngines(organizationId, discovery);
  return { seedLanguages, discovery, generation, seedEngines };
});

/**
 * Sets up GEO tracking on a project that was added without it, for example
 * from the analytics pages: the same discovery, prompts and first scan as
 * creating a project from its website.
 */
export const setUpGeoOnProject = Effect.fn("geo.projectSetUp")(function* (
  organizationId: string,
  projectId: string,
  url: string,
  scanEnabled: boolean,
  languages?: readonly string[]
) {
  const { seedLanguages, discovery, generation, seedEngines } =
    yield* discoverProjectSeed(organizationId, url, languages);
  const { aliases, companyName, products, entries, conversations } = generation;

  yield* geoTransaction("GEO setup failed", (tx) =>
    persistGeoWebsiteGeneration(tx, {
      organizationId,
      projectId,
      companyName,
      aliases,
      products,
      entries,
      conversations,
      discoveredCompetitors: discovery.competitors,
      seedEngines,
      seedLanguages,
      trackingEnabled: true,
    })
  ).pipe(
    Effect.catchTag("GeoDatabaseError", (cause) =>
      Effect.fail(
        new GeoDiscoveryError({
          message: "Failed to set up GEO tracking",
          cause,
        })
      )
    )
  );
  yield* Effect.promise(() => bumpGeoCheckGeneration([organizationId]));
  yield* startGeoScanAfterWebsiteGeneration(
    organizationId,
    projectId,
    scanEnabled
  );
});

export const createGeoProjectFromWebsite = Effect.fn(
  "geo.projectCreateFromWebsite"
)(function* (
  organizationId: string,
  name: string,
  brandSettingsId: string,
  url: string,
  scanEnabled: boolean,
  languages?: readonly string[],
  trackingEnabled = true
) {
  const { seedLanguages, discovery, generation, seedEngines } =
    yield* discoverProjectSeed(organizationId, url, languages);
  const { aliases, companyName, products, entries, conversations } = generation;

  const project = yield* geoTransaction("project create failed", (tx) =>
    Effect.gen(function* () {
      const rows = yield* geoDb("project insert failed", () =>
        tx
          .insert(projects)
          .values({
            id: crypto.randomUUID(),
            organizationId,
            name: name.trim(),
            brandSettingsId,
          })
          .returning()
      );
      const row = rows.at(0);
      if (!row) {
        return yield* Effect.fail(
          new GeoDiscoveryError({
            message: "Failed to create and configure the project",
            cause: new Error("Project insert returned no row"),
          })
        );
      }

      yield* persistGeoWebsiteGeneration(tx, {
        organizationId,
        projectId: row.id,
        companyName,
        aliases,
        products,
        entries,
        conversations,
        discoveredCompetitors: discovery.competitors,
        seedEngines,
        seedLanguages,
        trackingEnabled,
      });
      return toGeoProject(row);
    })
  ).pipe(
    Effect.catchTag("GeoDatabaseError", (cause) =>
      Effect.fail(
        new GeoDiscoveryError({
          message: "Failed to create and configure the project",
          cause,
        })
      )
    )
  );

  yield* Effect.promise(() =>
    invalidateGeoIngestHostsCache(organizationId, project.id)
  );
  yield* startGeoScanAfterWebsiteGeneration(
    organizationId,
    project.id,
    scanEnabled
  );
  return project;
});
