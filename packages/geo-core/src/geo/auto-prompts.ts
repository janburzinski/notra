import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import { gateway } from "@notra/ai/gateway";
import { db } from "@notra/db/drizzle";
import { geoCompetitors, geoSettings } from "@notra/db/schema";
import { generateText, Output } from "ai";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_AUTO_PROMPT_ATTEMPTS,
  GEO_AUTO_PROMPT_COMPETITOR_SLOTS,
  GEO_AUTO_PROMPT_IDS,
  GEO_AUTO_PROMPT_IN_HOUSE_REGEX,
  GEO_AUTO_PROMPT_MAX_CONTEXT_PROMPTS,
  GEO_AUTO_PROMPT_MAX_TOKENS,
  GEO_AUTO_PROMPT_MAX_WORDS,
  GEO_AUTO_PROMPT_MIN_WORDS,
  GEO_AUTO_PROMPT_SLOTS,
  GEO_AUTO_PROMPT_SYSTEM_PROMPT,
  GEO_PROMPT_MAX_LENGTH,
  GEO_PROMPT_MIN_LENGTH,
  GEO_WEBSITE_DISCOVERY_MODEL,
} from "../constants/geo";
import { geoAutoPromptsSchema } from "../schemas/geo";
import type {
  GeoAutoPromptContext,
  GeoAutoPromptId,
  GeoAutoPromptSlotOutput,
  GeoBrandContext,
  GeoPromptDefinition,
  GeoSettings,
} from "../types/geo";
import { geoDb, geoSkip } from "./effect";
import { GeoDiscoveryError } from "./errors";
import { buildBrandTerms, promptMentionsBrand } from "./suggestion-keywords";

const WHITESPACE_REGEX = /\s+/g;
const NON_ALPHANUMERIC_REGEX = /[^\p{L}\p{N}]+/gu;
const MIN_PRODUCT_KEY_LENGTH = 3;
const YEAR_REGEX = /\b20\d{2}\b/;
const OPENING_WORDS = 3;

function formatList(values: readonly string[]): string {
  return values.length > 0
    ? values.map((value) => `- ${value}`).join("\n")
    : "- (none)";
}

function buildAutoPromptsRequest(context: GeoAutoPromptContext): string {
  const brand = context.companyName;
  const slots = GEO_AUTO_PROMPT_IDS.map(
    (id) => `- "${id}": ${GEO_AUTO_PROMPT_SLOTS[id]}`
  ).join("\n");

  return `Company (never name it): ${brand}
Other names for it (never use): ${context.aliases.join(", ") || "(none)"}

What ${brand} does:
${context.companyDescription?.trim() || "(not provided, infer it from the tracked prompts)"}

Who buys it:
${context.audience?.trim() || "(not provided)"}

Known competitors:
${formatList(context.competitors)}

Prompts already tracked (do not repeat or paraphrase them):
${formatList(context.trackedPrompts)}

Write one prompt for each slot below. Each prompt is the exact text a real buyer would type into an AI assistant while looking for what ${brand} sells, before they know ${brand} exists.

Slots:
${slots}

Rules:
- Name the job the way the buyer would say it out loud, for example "API keys and rate limiting for my API" rather than "a unified API infrastructure platform". Never copy or reword the description above: no taglines, value propositions, hype adjectives or em dashes.
- Stay at the level of the product. If ${brand} would not be a direct answer to the question, rewrite it.
- Every prompt covers a different need or angle. No two prompts start with the same three words. Do not start more than two prompts with "what".
- Between ${GEO_AUTO_PROMPT_MIN_WORDS} and ${GEO_AUTO_PROMPT_MAX_WORDS} words. Plain conversational English, normal capitalization, one question or request each. Context only where the slot asks for it.
- Write for the most common reasons people buy this kind of product today. The description may lead with a new feature, an announcement or a trend; at most one prompt may be about that, and the rest cover the core job.
- Never name ${brand}, its products, its other names or its domain. Only the alternatives and comparison slots may name other products, and only ones from the known competitors list. Never name any other company or product, even a well-known one.
- No years, dates, prices, release news or invented claims.

For each slot return "prompt" and "products": every company or product name used in that prompt, exactly as written, or an empty list. Programming languages, frameworks and standards the buyer already uses (React, Postgres, HIPAA) are not products.`;
}

function openingKey(text: string): string {
  return text
    .toLowerCase()
    .split(WHITESPACE_REGEX)
    .slice(0, OPENING_WORDS)
    .join(" ");
}

function productKey(value: string): string {
  return value
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, " ")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

function isTrackedProduct(name: string, competitors: readonly string[]) {
  const key = productKey(name);
  return competitors.some((competitor) => {
    const competitorKey = productKey(competitor);
    if (key.length === 0 || competitorKey.length === 0) {
      return false;
    }
    if (key === competitorKey) {
      return true;
    }
    return (
      Math.min(key.length, competitorKey.length) >= MIN_PRODUCT_KEY_LENGTH &&
      (competitorKey.includes(key) || key.includes(competitorKey))
    );
  });
}

function namesTrackedCompetitor(
  text: string,
  competitors: readonly string[]
): boolean {
  return competitors.some((competitor) =>
    promptMentionsBrand(text, [competitor])
  );
}

function isAcceptedSlot(
  id: GeoAutoPromptId,
  slot: GeoAutoPromptSlotOutput,
  text: string,
  context: GeoAutoPromptContext,
  brandTerms: string[]
): boolean {
  const words = text.split(WHITESPACE_REGEX).length;
  if (
    text.length < GEO_PROMPT_MIN_LENGTH ||
    text.length > GEO_PROMPT_MAX_LENGTH ||
    words < GEO_AUTO_PROMPT_MIN_WORDS ||
    words > GEO_AUTO_PROMPT_MAX_WORDS ||
    YEAR_REGEX.test(text) ||
    promptMentionsBrand(text, brandTerms)
  ) {
    return false;
  }
  const namesCompetitor = namesTrackedCompetitor(text, context.competitors);
  if (!GEO_AUTO_PROMPT_COMPETITOR_SLOTS.has(id)) {
    return slot.products.length === 0 && !namesCompetitor;
  }
  return (
    slot.products.every(
      (product) =>
        promptMentionsBrand(text, [product]) &&
        isTrackedProduct(product, context.competitors)
    ) &&
    (slot.products.length > 0 ||
      namesCompetitor ||
      GEO_AUTO_PROMPT_IN_HOUSE_REGEX.test(text))
  );
}

function acceptAutoPrompts(
  output: Record<GeoAutoPromptId, GeoAutoPromptSlotOutput>,
  context: GeoAutoPromptContext,
  accepted: Map<GeoAutoPromptId, string>
): void {
  const brandTerms = buildBrandTerms(context);
  const openings = new Set([...accepted.values()].map(openingKey));
  for (const id of GEO_AUTO_PROMPT_IDS) {
    if (accepted.has(id)) {
      continue;
    }
    const slot = output[id];
    const text = slot.prompt.trim().replace(WHITESPACE_REGEX, " ");
    const opening = openingKey(text);
    if (
      openings.has(opening) ||
      !isAcceptedSlot(id, slot, text, context, brandTerms)
    ) {
      continue;
    }
    openings.add(opening);
    accepted.set(id, text);
  }
}

const requestAutoPrompts = Effect.fn("geo.autoPrompts.request")(function* (
  organizationId: string,
  context: GeoAutoPromptContext
) {
  return yield* Effect.tryPromise({
    try: async () => {
      const result = await generateText({
        model: gateway(GEO_WEBSITE_DISCOVERY_MODEL, { organizationId }),
        providerOptions: { gateway: { tags: ["geo-auto-prompts"] } },
        output: Output.object({ schema: geoAutoPromptsSchema }),
        prompt: buildAutoPromptsRequest(context),
        instructions: GEO_AUTO_PROMPT_SYSTEM_PROMPT,
        maxOutputTokens: GEO_AUTO_PROMPT_MAX_TOKENS,
      });
      return result.output;
    },
    catch: (cause) =>
      new GeoDiscoveryError({
        message: "Failed to generate auto prompts",
        cause,
      }),
  });
});

const generateGeoAutoPrompts = Effect.fn("geo.autoPrompts.generate")(function* (
  organizationId: string,
  context: GeoAutoPromptContext
) {
  const accepted = new Map<GeoAutoPromptId, string>();
  for (
    let attempt = 0;
    attempt < GEO_AUTO_PROMPT_ATTEMPTS &&
    accepted.size < GEO_AUTO_PROMPT_IDS.length;
    attempt++
  ) {
    const request = requestAutoPrompts(organizationId, context);
    const output =
      attempt === 0
        ? yield* request
        : yield* request.pipe(geoSkip("auto prompt retry failed"));
    if (!output) {
      break;
    }
    acceptAutoPrompts(output, context, accepted);
  }
  const prompts: GeoPromptDefinition[] = [];
  for (const id of GEO_AUTO_PROMPT_IDS) {
    const text = accepted.get(id);
    if (text) {
      prompts.push({ id, text });
    }
  }
  return prompts;
});

export const ensureGeoAutoPrompts = Effect.fn("geo.autoPrompts.ensure")(
  function* (
    settings: GeoSettings,
    brand: GeoBrandContext | null,
    trackedPrompts: readonly string[]
  ) {
    const row = yield* geoDb("auto prompts lookup failed", () =>
      db.query.geoSettings.findFirst({
        columns: { autoPrompts: true, updatedAt: true },
        where: eq(geoSettings.projectId, settings.projectId),
      })
    );
    if (row?.autoPrompts) {
      return row.autoPrompts;
    }
    const hasContext =
      Boolean(brand?.companyDescription?.trim()) || trackedPrompts.length > 0;
    if (!row || !hasContext || settings.promptLanguage !== DEFAULT_LANGUAGE) {
      return null;
    }

    const competitorRows = yield* geoDb("competitors lookup failed", () =>
      db.query.geoCompetitors.findMany({
        columns: { name: true },
        where: eq(geoCompetitors.projectId, settings.projectId),
        orderBy: [asc(geoCompetitors.createdAt)],
      })
    );
    const generated = yield* generateGeoAutoPrompts(settings.organizationId, {
      companyName: settings.companyName,
      aliases: settings.aliases,
      companyDescription: brand?.companyDescription ?? null,
      audience: brand?.audience ?? null,
      competitors: competitorRows.map((competitor) => competitor.name),
      trackedPrompts: trackedPrompts.slice(
        0,
        GEO_AUTO_PROMPT_MAX_CONTEXT_PROMPTS
      ),
    }).pipe(
      geoSkip("auto prompt generation failed", {
        projectId: settings.projectId,
      })
    );
    if (!generated || generated.length === 0) {
      return null;
    }

    const saved = yield* geoDb("auto prompts save failed", () =>
      db
        .update(geoSettings)
        .set({ autoPrompts: generated })
        .where(
          and(
            eq(geoSettings.projectId, settings.projectId),
            isNull(geoSettings.autoPrompts),
            sql`date_trunc('milliseconds', ${geoSettings.updatedAt}) = ${row.updatedAt}`
          )
        )
        .returning({ autoPrompts: geoSettings.autoPrompts })
    );
    if (saved.at(0)?.autoPrompts) {
      return generated;
    }
    const current = yield* geoDb("auto prompts lookup failed", () =>
      db.query.geoSettings.findFirst({
        columns: { autoPrompts: true },
        where: eq(geoSettings.projectId, settings.projectId),
      })
    );
    return current?.autoPrompts ?? null;
  }
);
