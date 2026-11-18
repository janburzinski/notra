import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import { gateway } from "@notra/ai/gateway";
import { db } from "@notra/db/drizzle";
import {
  geoProducts,
  geoPromptSuggestions,
  geoPrompts,
  geoSettings,
} from "@notra/db/schema";
import { generateText, Output } from "ai";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_DISCOVERY_SYSTEM_PROMPT,
  GEO_PRODUCT_SUGGEST_CONTEXT_LIMIT,
  GEO_PRODUCT_SUGGEST_COUNT,
  GEO_PRODUCT_SUGGEST_MAX_TOKENS,
  GEO_PRODUCT_SUGGEST_MODEL,
  GEO_PRODUCT_SUGGEST_REASON_MAX_LENGTH,
  GEO_PRODUCT_SUGGEST_TIMEOUT_MS,
  GEO_PROMPT_MAX_LENGTH,
  GEO_PROMPT_MIN_LENGTH,
} from "../constants/geo";
import { geoProductSuggestResultSchema } from "../schemas/geo";
import type { GeoProduct, GeoPromptIntent, GeoScopeInput } from "../types/geo";
import type { GeoProductSuggestionsResponse } from "../types/suggestions";
import { geoDb, geoSkip } from "./effect";
import { GeoDiscoveryError, GeoProductSuggestError } from "./errors";
import { lockGeoProjectInTransaction } from "./lock";
import { requireGeoProject } from "./projects";
import { promptKey } from "./prompt-key";

interface ProductContext {
  product: GeoProduct;
  others: readonly GeoProduct[];
  tracked: readonly string[];
  /** Earlier suggestions in any state, so dismissed ones don't come back. */
  previous: readonly string[];
  language: string;
}

function bulletList(lines: readonly string[]): string {
  return lines.length > 0
    ? lines
        .slice(0, GEO_PRODUCT_SUGGEST_CONTEXT_LIMIT)
        .map((line) => `- ${line}`)
        .join("\n")
    : "(none)";
}

function buildProductSuggestPrompt(context: ProductContext): string {
  const { product, others, tracked, previous, language } = context;
  const describe = (entry: GeoProduct) =>
    entry.niche ? `${entry.name}: ${entry.niche}` : entry.name;
  return `Product: ${describe(product)}

Other products from the same company (don't write prompts for these):
${bulletList(others.map(describe))}

Prompts already tracked for this product:
${bulletList(tracked)}

Prompts suggested before (don't repeat or rephrase these either):
${bulletList(previous)}

Suggest ${GEO_PRODUCT_SUGGEST_COUNT} new prompts a real person would type into an AI assistant where ${product.name} could be the answer. Cover gaps in the tracked list: different problems, audiences and moments.
- Never name the company or the product.
- Mix intents: "problem" (describes a pain or goal), "list" (asks for options), "comparison" (weighs named alternatives, competitors only), "how_to" (asks how to do something).
- Write every prompt in ${language}, ${GEO_PROMPT_MIN_LENGTH} to ${GEO_PROMPT_MAX_LENGTH} characters.
- reason: in ${language}, under 12 words, which gap the prompt covers.`;
}

const loadSuggestContext = (projectId: string) =>
  geoDb("load product suggestion context", async () => {
    const [products, prompts, previous, settings] = await Promise.all([
      db
        .select({
          id: geoProducts.id,
          name: geoProducts.name,
          niche: geoProducts.niche,
          position: geoProducts.position,
        })
        .from(geoProducts)
        .where(eq(geoProducts.projectId, projectId))
        .orderBy(asc(geoProducts.position), asc(geoProducts.createdAt)),
      db
        .select({ prompt: geoPrompts.prompt, productId: geoPrompts.productId })
        .from(geoPrompts)
        .where(eq(geoPrompts.projectId, projectId)),
      db
        .select({
          prompt: geoPromptSuggestions.prompt,
          productId: geoPromptSuggestions.productId,
        })
        .from(geoPromptSuggestions)
        .where(
          and(
            eq(geoPromptSuggestions.projectId, projectId),
            eq(geoPromptSuggestions.source, "product")
          )
        ),
      db.query.geoSettings.findFirst({
        columns: { promptLanguage: true },
        where: eq(geoSettings.projectId, projectId),
      }),
    ]);
    return {
      products,
      prompts,
      previous,
      language: settings?.promptLanguage ?? DEFAULT_LANGUAGE,
    };
  });

const suggestForProduct = (organizationId: string, context: ProductContext) =>
  Effect.tryPromise({
    // Reading output throws when the model returned none, so it stays in here.
    try: async (signal) =>
      (
        await generateText({
          model: gateway(GEO_PRODUCT_SUGGEST_MODEL, { organizationId }),
          providerOptions: { gateway: { tags: ["geo-product-suggest"] } },
          output: Output.object({ schema: geoProductSuggestResultSchema }),
          instructions: GEO_DISCOVERY_SYSTEM_PROMPT,
          prompt: buildProductSuggestPrompt(context),
          maxOutputTokens: GEO_PRODUCT_SUGGEST_MAX_TOKENS,
          abortSignal: signal,
        })
      ).output,
    catch: (cause) =>
      new GeoDiscoveryError({ message: "Failed to suggest prompts", cause }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: GEO_PRODUCT_SUGGEST_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new GeoDiscoveryError({ message: "Suggesting prompts timed out" })
        ),
    }),
    Effect.map((result) => result.suggestions),
    // One product failing leaves its old suggestions; the others still update.
    geoSkip("product prompt suggestions failed", {
      productId: context.product.id,
    })
  );

const loadProductSuggestions = (projectId: string) =>
  geoDb("list product suggestions", async () => {
    const [products, rows, latest] = await Promise.all([
      db
        .select({
          id: geoProducts.id,
          name: geoProducts.name,
          niche: geoProducts.niche,
          position: geoProducts.position,
        })
        .from(geoProducts)
        .where(eq(geoProducts.projectId, projectId))
        .orderBy(asc(geoProducts.position), asc(geoProducts.createdAt)),
      db
        .select()
        .from(geoPromptSuggestions)
        .where(
          and(
            eq(geoPromptSuggestions.projectId, projectId),
            eq(geoPromptSuggestions.source, "product"),
            eq(geoPromptSuggestions.status, "pending")
          )
        )
        .orderBy(
          asc(geoPromptSuggestions.createdAt),
          asc(geoPromptSuggestions.id)
        ),
      db
        .select({ at: max(geoPromptSuggestions.createdAt) })
        .from(geoPromptSuggestions)
        .where(
          and(
            eq(geoPromptSuggestions.projectId, projectId),
            eq(geoPromptSuggestions.source, "product")
          )
        ),
    ]);
    const response: GeoProductSuggestionsResponse = {
      products,
      suggestions: rows.flatMap((row) =>
        row.productId
          ? [
              {
                id: row.id,
                productId: row.productId,
                prompt: row.prompt,
                intent: (row.intent as GeoPromptIntent | null) ?? null,
                reason: row.reason,
                createdAt: row.createdAt.toISOString(),
              },
            ]
          : []
      ),
      generatedAt: latest[0]?.at?.toISOString() ?? null,
    };
    return response;
  });

/** Pending prompt suggestions for each of the project's products. */
export const listProductSuggestions = Effect.fn("geo.productSuggestions.list")(
  function* (input: GeoScopeInput) {
    const { projectId } = yield* requireGeoProject(input);
    return yield* loadProductSuggestions(projectId);
  }
);

/**
 * Writes fresh suggestions for every product, one call each in parallel. A
 * product's pending suggestions are replaced only when its call returns at
 * least one new prompt.
 * Replaced, tracked and dismissed ones all stay stored, so none is ever
 * suggested again. Fails only when no product's call succeeds.
 */
export const generateProductSuggestions = Effect.fn(
  "geo.productSuggestions.generate"
)(function* (input: GeoScopeInput) {
  const { projectId } = yield* requireGeoProject(input);
  const { products, prompts, previous, language } =
    yield* loadSuggestContext(projectId);
  if (products.length === 0) {
    return yield* loadProductSuggestions(projectId);
  }

  const results = yield* Effect.forEach(
    products,
    (product) =>
      suggestForProduct(input.organizationId, {
        product,
        others: products.filter((entry) => entry.id !== product.id),
        tracked: prompts
          .filter((row) => row.productId === product.id)
          .map((row) => row.prompt),
        previous: previous
          .filter((row) => row.productId === product.id)
          .map((row) => row.prompt),
        language,
      }).pipe(Effect.map((suggestions) => ({ product, suggestions }))),
    { concurrency: "unbounded" }
  );

  // Never suggest a prompt the project tracks or was offered before.
  const seen = new Set(
    [...prompts, ...previous].map((row) => promptKey(row.prompt))
  );
  const answered = results.filter((entry) => entry.suggestions !== null);
  if (answered.length === 0) {
    return yield* Effect.fail(
      new GeoProductSuggestError({
        message: "Every product's suggestion call failed",
      })
    );
  }
  const writtenAt = Date.now();
  const rows = answered.flatMap(({ product, suggestions }) =>
    (suggestions ?? []).flatMap((suggestion) => {
      const prompt = suggestion.prompt.trim();
      const key = promptKey(prompt);
      if (
        prompt.length < GEO_PROMPT_MIN_LENGTH ||
        prompt.length > GEO_PROMPT_MAX_LENGTH ||
        seen.has(key)
      ) {
        return [];
      }
      seen.add(key);
      return [
        {
          id: crypto.randomUUID(),
          // Rows share one insert; distinct timestamps keep the model's order.
          createdAt: new Date(writtenAt + seen.size),
          organizationId: input.organizationId,
          projectId,
          productId: product.id,
          prompt,
          source: "product" as const,
          action: "track" as const,
          intent: suggestion.intent,
          reason:
            suggestion.reason
              .trim()
              .slice(0, GEO_PRODUCT_SUGGEST_REASON_MAX_LENGTH) || null,
        },
      ];
    })
  );

  if (rows.length === 0) {
    return yield* loadProductSuggestions(projectId);
  }
  yield* geoDb("save product suggestions", () =>
    db.transaction(async (tx) => {
      // Another refresh may have saved while this one waited on the model:
      // check the history again under the project lock, so this one never
      // dismisses suggestions it then can't replace.
      await lockGeoProjectInTransaction(tx, projectId);
      const offered = await tx
        .select({ prompt: geoPromptSuggestions.prompt })
        .from(geoPromptSuggestions)
        .where(
          and(
            eq(geoPromptSuggestions.projectId, projectId),
            eq(geoPromptSuggestions.source, "product")
          )
        );
      const taken = new Set(offered.map((row) => promptKey(row.prompt)));
      const fresh = rows.filter((row) => !taken.has(promptKey(row.prompt)));
      // Products whose answer held nothing new keep their current suggestions.
      const refreshed = [...new Set(fresh.map((row) => row.productId))];
      if (refreshed.length === 0) {
        return;
      }
      // Replaced suggestions are dismissed, not deleted, so the repeat check
      // above still sees them on the next refresh.
      await tx
        .update(geoPromptSuggestions)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(geoPromptSuggestions.projectId, projectId),
            eq(geoPromptSuggestions.source, "product"),
            eq(geoPromptSuggestions.status, "pending"),
            inArray(geoPromptSuggestions.productId, refreshed)
          )
        );
      await tx.insert(geoPromptSuggestions).values(fresh).onConflictDoNothing();
    })
  );
  return yield* loadProductSuggestions(projectId);
});
