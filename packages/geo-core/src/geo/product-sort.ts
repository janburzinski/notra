import { gateway } from "@notra/ai/gateway";
import { db } from "@notra/db/drizzle";
import { geoProducts, geoPrompts } from "@notra/db/schema";
import { generateText, Output } from "ai";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_DISCOVERY_SYSTEM_PROMPT,
  GEO_PRODUCT_SORT_BATCH_CONCURRENCY,
  GEO_PRODUCT_SORT_MAX_BATCHES,
  GEO_PRODUCT_SORT_INLINE_TIMEOUT_MS,
  GEO_PRODUCT_SORT_MAX_PROMPTS,
  GEO_PRODUCT_SORT_MAX_TOKENS,
  GEO_PRODUCT_SORT_MODEL,
  GEO_PRODUCT_SORT_TIMEOUT_MS,
} from "../constants/geo";
import { geoProductSortResultSchema } from "../schemas/geo";
import { geoDb, geoSkip } from "./effect";
import { GeoDiscoveryError } from "./errors";

interface SortOptions {
  /** Only these prompts; otherwise every prompt without a product. */
  promptIds?: readonly string[];
  /** Only file prompts into this product; the others stay where they are. */
  intoProductId?: string;
  timeoutMs?: number;
}

interface SortProduct {
  id: string;
  name: string;
  niche: string | null;
}

function buildProductSortPrompt(
  products: readonly SortProduct[],
  prompts: readonly string[]
): string {
  const productList = products
    .map((product) =>
      product.niche
        ? `- ${product.name}: ${product.niche}`
        : `- ${product.name}`
    )
    .join("\n");
  const promptList = prompts
    .map((prompt, index) => `${index}. ${prompt}`)
    .join("\n");
  return `A company tracks these products:
${productList}

Sort each prompt below. Return one entry per prompt with its index.
- product: the exact name of the product that would answer the prompt. Prompts rarely name it: someone comparing rivals or describing their problem still belongs to the product that solves it. When several fit, pick the one listed first unless the prompt asks for what makes another one different. Use null when the prompt is about the company itself (jobs, funding, founders), about something the company offers that is not on this list, or when no product fits.
- intent: "problem" (describes a pain or goal), "list" (asks for options or the best tools), "comparison" (weighs named options), "how_to" (asks how to do something), or null when none fits.

Prompts:
${promptList}`;
}

/** The project's prompts without a product, oldest first, up to the batch cap. */
const loadUnfiledPromptIds = (projectId: string) =>
  geoDb("load unfiled prompts", async () => {
    const rows = await db
      .select({ id: geoPrompts.id })
      .from(geoPrompts)
      .where(
        and(eq(geoPrompts.projectId, projectId), isNull(geoPrompts.productId))
      )
      .orderBy(asc(geoPrompts.createdAt))
      .limit(GEO_PRODUCT_SORT_MAX_PROMPTS * GEO_PRODUCT_SORT_MAX_BATCHES);
    return rows.map((row) => row.id);
  });

const loadSortInput = (projectId: string, promptIds?: readonly string[]) =>
  geoDb("load prompts to sort", async () => {
    const [products, prompts] = await Promise.all([
      db
        .select({
          id: geoProducts.id,
          name: geoProducts.name,
          niche: geoProducts.niche,
        })
        .from(geoProducts)
        .where(eq(geoProducts.projectId, projectId))
        .orderBy(asc(geoProducts.position), asc(geoProducts.createdAt)),
      db
        .select({
          id: geoPrompts.id,
          prompt: geoPrompts.prompt,
          intent: geoPrompts.intent,
        })
        .from(geoPrompts)
        .where(
          and(
            eq(geoPrompts.projectId, projectId),
            isNull(geoPrompts.productId),
            promptIds ? inArray(geoPrompts.id, [...promptIds]) : undefined
          )
        )
        .orderBy(asc(geoPrompts.createdAt))
        .limit(GEO_PRODUCT_SORT_MAX_PROMPTS),
    ]);
    return { products, prompts };
  });

/**
 * Files prompts without a product into the project's products with one cheap
 * call: after setup, whenever prompts are added and when a product is created.
 * Prompts that fit no product stay where they are; values already set are kept.
 */
const sortPromptsIntoProducts = Effect.fn("geo.sortPromptsIntoProducts")(
  function* (organizationId: string, projectId: string, options: SortOptions) {
    if (options.promptIds?.length === 0) {
      return 0;
    }
    const { products, prompts } = yield* loadSortInput(
      projectId,
      options.promptIds
    );
    if (products.length === 0 || prompts.length === 0) {
      return 0;
    }

    const result = yield* Effect.tryPromise({
      // Reading output throws when the model returned none, so it stays in here.
      try: async (signal) =>
        (
          await generateText({
            model: gateway(GEO_PRODUCT_SORT_MODEL, { organizationId }),
            providerOptions: { gateway: { tags: ["geo-product-sort"] } },
            output: Output.object({ schema: geoProductSortResultSchema }),
            prompt: buildProductSortPrompt(
              products,
              prompts.map((row) => row.prompt)
            ),
            instructions: GEO_DISCOVERY_SYSTEM_PROMPT,
            maxOutputTokens: GEO_PRODUCT_SORT_MAX_TOKENS,
            abortSignal: signal,
          })
        ).output,
      catch: (cause) =>
        new GeoDiscoveryError({ message: "Failed to sort prompts", cause }),
    }).pipe(
      // Setup waits for this call, so a stuck provider must not hold it up.
      Effect.timeoutOrElse({
        duration: options.timeoutMs ?? GEO_PRODUCT_SORT_TIMEOUT_MS,
        orElse: () =>
          Effect.fail(
            new GeoDiscoveryError({ message: "Sorting prompts timed out" })
          ),
      })
    );

    const productIdByName = new Map(
      products.map((product) => [product.name.toLowerCase(), product.id])
    );
    const byProduct = new Map<string, string[]>();
    const byIntent = new Map<string, string[]>();
    for (const entry of result.prompts) {
      const row = prompts[entry.index];
      if (!row) {
        continue;
      }
      const productId = entry.product
        ? productIdByName.get(entry.product.trim().toLowerCase())
        : undefined;
      if (
        !productId ||
        (options.intoProductId && productId !== options.intoProductId)
      ) {
        continue;
      }
      byProduct.set(productId, [...(byProduct.get(productId) ?? []), row.id]);
      if (entry.intent && !row.intent) {
        byIntent.set(entry.intent, [
          ...(byIntent.get(entry.intent) ?? []),
          row.id,
        ]);
      }
    }
    if (byProduct.size === 0) {
      return 0;
    }

    yield* geoDb("save sorted prompts", () =>
      db.transaction(async (tx) => {
        for (const [productId, ids] of byProduct) {
          // A prompt filed meanwhile keeps the product it was given.
          await tx
            .update(geoPrompts)
            .set({ productId })
            .where(
              and(inArray(geoPrompts.id, ids), isNull(geoPrompts.productId))
            );
        }
        for (const [intent, ids] of byIntent) {
          await tx
            .update(geoPrompts)
            .set({ intent })
            .where(and(inArray(geoPrompts.id, ids), isNull(geoPrompts.intent)));
        }
      })
    );
    return [...byProduct.values()].reduce((sum, ids) => sum + ids.length, 0);
  }
);

/**
 * Sorting is a nicety: a failure leaves prompts without a product and never
 * fails the save that triggered it. Resolves to how many prompts were filed.
 */
export const sortPromptsIntoProductsQuietly = Effect.fn(
  "geo.sortPromptsIntoProductsQuietly"
)(function* (
  organizationId: string,
  projectId: string,
  options: SortOptions = {}
) {
  const ids =
    options.promptIds ??
    (yield* loadUnfiledPromptIds(projectId).pipe(
      geoSkip("unfiled prompts lookup failed", { projectId })
    )) ??
    [];
  // One call reads GEO_PRODUCT_SORT_MAX_PROMPTS prompts, so larger sets go in
  // batches; one failed batch leaves only its own prompts unsorted.
  const batches: string[][] = [];
  for (
    let start = 0;
    start < ids.length && batches.length < GEO_PRODUCT_SORT_MAX_BATCHES;
    start += GEO_PRODUCT_SORT_MAX_PROMPTS
  ) {
    batches.push(ids.slice(start, start + GEO_PRODUCT_SORT_MAX_PROMPTS));
  }
  // One time limit for the whole pass, not per batch, so a save never waits
  // longer than it; batches that would start past it are left unsorted.
  const deadline =
    Date.now() + (options.timeoutMs ?? GEO_PRODUCT_SORT_TIMEOUT_MS);
  const sorted = yield* Effect.forEach(
    batches,
    (promptIds) => {
      const timeoutMs = deadline - Date.now();
      return timeoutMs <= 0
        ? Effect.succeed(0)
        : sortPromptsIntoProducts(organizationId, projectId, {
            ...options,
            promptIds,
            timeoutMs,
          }).pipe(geoSkip("prompt product sort failed", { projectId }));
    },
    { concurrency: GEO_PRODUCT_SORT_BATCH_CONCURRENCY }
  );
  return sorted.reduce<number>((sum, count) => sum + (count ?? 0), 0);
});

/** Files prompts that were just saved, without holding the save up for long. */
export const sortNewPromptsIntoProducts = (
  organizationId: string,
  projectId: string,
  promptIds: readonly string[]
) =>
  sortPromptsIntoProductsQuietly(organizationId, projectId, {
    promptIds,
    timeoutMs: GEO_PRODUCT_SORT_INLINE_TIMEOUT_MS,
  });

/** Files prompts without a product into a product that was just created. */
export const sortPromptsIntoNewProduct = (
  organizationId: string,
  projectId: string,
  productId: string
) =>
  sortPromptsIntoProductsQuietly(organizationId, projectId, {
    intoProductId: productId,
    timeoutMs: GEO_PRODUCT_SORT_INLINE_TIMEOUT_MS,
  });

/**
 * Re-reads one prompt after sorting may have given it a product. Best effort:
 * the prompt is already saved, so a failed read must not fail the save.
 */
export const reloadSortedPrompt = (promptId: string) =>
  geoDb("reload sorted prompt", () =>
    db.query.geoPrompts.findFirst({ where: eq(geoPrompts.id, promptId) })
  ).pipe(geoSkip("sorted prompt reload failed", { promptId }));
