import { createHash } from "node:crypto";

import { gateway } from "@notra/ai/gateway";
import { db } from "@notra/db/drizzle";
import { geoSettings } from "@notra/db/schema";
import { generateText, Output } from "ai";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_DISCOVERY_SYSTEM_PROMPT,
  GEO_PRODUCT_NAME_MAX_LENGTH,
  GEO_PRODUCT_NICHE_MAX_LENGTH,
  GEO_PRODUCT_SITE_CHECK_BATCH_SIZE,
  GEO_PRODUCT_SITE_CHECK_CREATE_RESERVE_MS,
  GEO_PRODUCT_SITE_CHECK_INTERVAL_MS,
  GEO_PRODUCT_SITE_CHECK_FIRST_MAX_NEW,
  GEO_PRODUCT_SITE_CHECK_MAX_NEW,
  GEO_PRODUCT_SITE_CHECK_MAX_TOKENS,
  GEO_PRODUCT_SITE_CHECK_MIN_MODEL_MS,
  GEO_PRODUCT_SITE_CHECK_MIN_READ_MS,
  GEO_PRODUCT_SITE_CHECK_MODEL,
  GEO_PRODUCT_SITE_CHECK_TIMEOUT_MS,
  GEO_PRODUCTS_MAX,
} from "../constants/geo";
import { geoProductSiteCheckSchema } from "../schemas/geo";
import type { GeoProduct } from "../types/geo";
import { scrapeWebsite } from "./discover";
import { geoDb, geoSkip } from "./effect";
import { GeoDiscoveryError } from "./errors";
import { createGeoProduct, listGeoProducts } from "./programs";
import { loadGeoProjectBrand } from "./project-brand";

interface SiteCheckScope {
  organizationId: string;
  projectId: string;
}

/** deferred: not enough time left in the run; the project stays due. */
type SiteCheckSkip =
  | "no_website"
  | "unchanged"
  | "full"
  | "failed"
  | "deferred";

export type GeoProductSiteCheckResult =
  | { status: SiteCheckSkip; added: [] }
  | { status: "checked"; added: GeoProduct[] };

function describe(product: { name: string; niche: string | null }) {
  return product.niche ? `${product.name}: ${product.niche}` : product.name;
}

export function buildProductSiteCheckPrompt(
  url: string,
  content: string,
  existing: readonly { name: string; niche: string | null }[],
  removed: readonly string[]
): string {
  const tracked =
    existing.length > 0
      ? existing.map((product) => `- ${describe(product)}`).join("\n")
      : "- (none yet)";
  const skipped =
    removed.length > 0
      ? `\nThe user removed these; never list them again: ${removed.map((name) => `"${name}"`).join(", ")}.`
      : "";
  return `Website: ${url}

Website content:
"""
${content}
"""

Products this project already tracks:
${tracked}${skipped}

List every product this company sells today that a buyer would look for on its own: separate apps, product lines or named models. Copy a tracked product's name exactly when it is still sold. Use the exact name the site gives a product, never a category you describe. Plans and tiers (Pro, Teams, Enterprise), add-ons, accessories, single features, audience segments and collections do not count. Give each a "name" and a "niche": who it is for and the job it does, in under 15 plain words. Only list a product the content above names; when unsure, leave it out.`;
}

/** Products the site check may add: new, not removed, and named on the site. */
export function newProductsFromSiteCheck(
  candidates: readonly { name: string; niche: string }[],
  existing: readonly { name: string }[],
  removed: readonly string[],
  content: string,
  room: number
): { name: string; niche: string | null }[] {
  const known = new Set(
    [...existing.map((product) => product.name), ...removed].map((name) =>
      name.trim().toLowerCase()
    )
  );
  const page = content.toLowerCase();
  const result: { name: string; niche: string | null }[] = [];
  for (const candidate of candidates) {
    if (result.length >= room) {
      break;
    }
    const name = candidate.name.trim().slice(0, GEO_PRODUCT_NAME_MAX_LENGTH);
    const key = name.toLowerCase();
    // The model may only add what the page actually names.
    if (name.length === 0 || known.has(key) || !page.includes(key)) {
      continue;
    }
    known.add(key);
    const niche = candidate.niche.trim().slice(0, GEO_PRODUCT_NICHE_MAX_LENGTH);
    result.push({ name, niche: niche || null });
  }
  return result;
}

const markChecked = (projectId: string, hash: string | null) =>
  geoDb("product site check mark failed", () =>
    db
      .update(geoSettings)
      .set({
        productsCheckedAt: new Date(),
        ...(hash ? { productsSiteHash: hash } : {}),
      })
      .where(eq(geoSettings.projectId, projectId))
  );

function skipped(status: SiteCheckSkip): GeoProductSiteCheckResult {
  return { status, added: [] };
}

/**
 * Re-reads a project's website and adds products it doesn't track yet; each
 * picks up the prompts without a product that fit it. Skips the model when
 * the site's content is unchanged since the last check, and never adds back a
 * product someone deleted. A failed read or call waits for next week.
 */
export const checkGeoProductsOnSite = Effect.fn("geo.products.siteCheck")(
  function* (scope: SiteCheckScope, deadline = Number.POSITIVE_INFINITY) {
    const left = () => deadline - Date.now();
    const [brand, settings, listed] = yield* Effect.all([
      loadGeoProjectBrand(scope),
      geoDb("product site check settings failed", () =>
        db.query.geoSettings.findFirst({
          columns: {
            removedProductNames: true,
            productsSiteHash: true,
            productsCheckedAt: true,
          },
          where: eq(geoSettings.projectId, scope.projectId),
        })
      ),
      listGeoProducts(scope),
    ]);
    const url = brand?.websiteUrl;
    if (!(url && URL.canParse(url) && settings)) {
      yield* markChecked(scope.projectId, null);
      return skipped("no_website");
    }
    const existing = listed.products;
    if (existing.length >= GEO_PRODUCTS_MAX) {
      yield* markChecked(scope.projectId, null);
      return skipped("full");
    }

    if (left() < GEO_PRODUCT_SITE_CHECK_MIN_READ_MS) {
      return skipped("deferred");
    }
    const content = yield* scrapeWebsite(url).pipe(
      geoSkip("product site check scrape failed", {
        projectId: scope.projectId,
      })
    );
    if (!content) {
      yield* markChecked(scope.projectId, null);
      return skipped("failed");
    }
    const hash = createHash("sha256").update(content).digest("hex");
    if (hash === settings.productsSiteHash) {
      yield* markChecked(scope.projectId, hash);
      return skipped("unchanged");
    }

    if (left() < GEO_PRODUCT_SITE_CHECK_MIN_MODEL_MS) {
      return skipped("deferred");
    }
    const removed = settings.removedProductNames;
    // The run's deadline, not the model's own limit, bounds this call.
    const budgetBound =
      left() - GEO_PRODUCT_SITE_CHECK_CREATE_RESERVE_MS <
      GEO_PRODUCT_SITE_CHECK_TIMEOUT_MS;
    const answer = yield* Effect.tryPromise({
      // Reading output throws when the model returned none, so it stays in here.
      try: async (signal) =>
        (
          await generateText({
            model: gateway(GEO_PRODUCT_SITE_CHECK_MODEL, {
              organizationId: scope.organizationId,
            }),
            providerOptions: { gateway: { tags: ["geo-product-site-check"] } },
            output: Output.object({ schema: geoProductSiteCheckSchema }),
            instructions: GEO_DISCOVERY_SYSTEM_PROMPT,
            prompt: buildProductSiteCheckPrompt(
              url,
              content,
              existing,
              removed
            ),
            maxOutputTokens: GEO_PRODUCT_SITE_CHECK_MAX_TOKENS,
            abortSignal: signal,
          })
        ).output,
      catch: (cause) =>
        new GeoDiscoveryError({ message: "Product site check failed", cause }),
    }).pipe(
      Effect.timeoutOrElse({
        // Leaves time to create at least one product before the deadline.
        duration: Math.min(
          GEO_PRODUCT_SITE_CHECK_TIMEOUT_MS,
          left() - GEO_PRODUCT_SITE_CHECK_CREATE_RESERVE_MS
        ),
        orElse: () =>
          Effect.fail(
            new GeoDiscoveryError({ message: "Product site check timed out" })
          ),
      }),
      geoSkip("product site check failed", { projectId: scope.projectId })
    );
    if (!answer) {
      // Cut short by the run's time, not a real failure: stay due.
      if (budgetBound) {
        return skipped("deferred");
      }
      yield* markChecked(scope.projectId, null);
      return skipped("failed");
    }

    // Everything the project has room for, of which this check adds a few.
    const eligible = newProductsFromSiteCheck(
      answer.products,
      existing,
      removed,
      content,
      GEO_PRODUCTS_MAX - existing.length
    );
    const added: GeoProduct[] = [];
    // One at a time: each new product sorts prompts after the one before it.
    // Existing projects get their products on the first check, like setup.
    const limit =
      settings.productsCheckedAt === null
        ? GEO_PRODUCT_SITE_CHECK_FIRST_MAX_NEW
        : GEO_PRODUCT_SITE_CHECK_MAX_NEW;
    let outOfTime = false;
    for (const product of eligible.slice(0, limit)) {
      if (left() < GEO_PRODUCT_SITE_CHECK_CREATE_RESERVE_MS) {
        outOfTime = true;
        break;
      }
      const created = yield* createGeoProduct({ ...scope, ...product }).pipe(
        geoSkip("product site check create failed", {
          projectId: scope.projectId,
        })
      );
      if (created) {
        added.push(created.product);
      }
    }
    // Out of time: leave the project due, so the next run adds the rest.
    if (outOfTime) {
      const result: GeoProductSiteCheckResult = { status: "checked", added };
      return result;
    }
    // Keep the old hash while products are left over (the cap or a failed
    // create), so next week's check reads the same page again.
    yield* markChecked(
      scope.projectId,
      added.length === eligible.length ? hash : null
    );
    const result: GeoProductSiteCheckResult = { status: "checked", added };
    return result;
  }
);

/** Enabled projects whose products weren't checked against their site this week. */
export const findDueGeoProductSiteChecks = (now: Date) =>
  geoDb("due product site checks lookup failed", () =>
    db
      .select({
        organizationId: geoSettings.organizationId,
        projectId: geoSettings.projectId,
      })
      .from(geoSettings)
      .where(
        and(
          eq(geoSettings.enabled, true),
          or(
            isNull(geoSettings.productsCheckedAt),
            lt(
              geoSettings.productsCheckedAt,
              new Date(now.getTime() - GEO_PRODUCT_SITE_CHECK_INTERVAL_MS)
            )
          )
        )
      )
      .orderBy(
        sql`case when ${geoSettings.productsCheckedAt} is null then 0 else 1 end`,
        asc(geoSettings.productsCheckedAt),
        sql`random()`
      )
      .limit(GEO_PRODUCT_SITE_CHECK_BATCH_SIZE)
  );
