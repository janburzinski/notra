import { gateway } from "@notra/ai/gateway";
import { db } from "@notra/db/drizzle";
import { geoProducts, geoPrompts } from "@notra/db/schema";
import { generateText, Output } from "ai";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_DISCOVERY_SYSTEM_PROMPT,
  GEO_PRODUCT_SORT_MAX_PROMPTS,
  GEO_PRODUCT_SORT_MAX_TOKENS,
  GEO_PRODUCT_SORT_MODEL,
  GEO_PRODUCT_SORT_TIMEOUT_MS,
} from "../constants/geo";
import { geoProductSortResultSchema } from "../schemas/geo";
import { geoDb, geoSkip } from "./effect";
import { GeoDiscoveryError } from "./errors";

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

const loadSortInput = (projectId: string) =>
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
          and(eq(geoPrompts.projectId, projectId), isNull(geoPrompts.productId))
        )
        .orderBy(asc(geoPrompts.createdAt))
        .limit(GEO_PRODUCT_SORT_MAX_PROMPTS),
    ]);
    return { products, prompts };
  });

/**
 * Files prompts without a product into the project's products with one cheap
 * call, so prompts saved before products existed don't all land in "Other".
 * Prompts that fit no product stay where they are; values already set are kept.
 */
const sortPromptsIntoProducts = Effect.fn("geo.sortPromptsIntoProducts")(
  function* (organizationId: string, projectId: string) {
    const { products, prompts } = yield* loadSortInput(projectId);
    if (products.length === 0 || prompts.length === 0) {
      return 0;
    }

    const result = yield* Effect.tryPromise({
      try: (signal) =>
        generateText({
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
        }),
      catch: (cause) =>
        new GeoDiscoveryError({ message: "Failed to sort prompts", cause }),
    }).pipe(
      // Setup waits for this call, so a stuck provider must not hold it up.
      Effect.timeoutOrElse({
        duration: GEO_PRODUCT_SORT_TIMEOUT_MS,
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
    for (const entry of result.output.prompts) {
      const row = prompts[entry.index];
      if (!row) {
        continue;
      }
      const productId = entry.product
        ? productIdByName.get(entry.product.trim().toLowerCase())
        : undefined;
      if (!productId) {
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

/** Sorting is a nicety: a failure leaves prompts in "Other" and never fails setup. */
export const sortPromptsIntoProductsQuietly = (
  organizationId: string,
  projectId: string
) =>
  sortPromptsIntoProducts(organizationId, projectId).pipe(
    geoSkip("prompt product sort failed", { projectId })
  );
