import type {
  GeoProductCreateOutcome,
  GeoProductCreatorInput,
  GeoProductDeleteOutcome,
  GeoProductDeleterInput,
  GeoProductUpdateOutcome,
  GeoProductUpdaterInput,
  GeoPromptMoveOutcome,
  GeoPromptMoverInput,
} from "@notra/ai/types/geo-products";
import { GEO_PRODUCTS_MAX } from "@notra/geo-core/constants/geo";
import { refreshGeoContentGapsBestEffort } from "@notra/geo-core/geo/gaps";
import {
  createGeoProduct,
  deleteGeoProduct,
  listGeoProducts,
  listGeoPrompts,
  updateGeoProduct,
  updateGeoPrompt,
} from "@notra/geo-core/geo/programs";
import { Effect, type Layer } from "effect";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { matchTrackedPrompt } from "@/utils/geo-prompt-scan";

const PROJECT_NOT_FOUND = "That project doesn't exist in this workspace.";

/** Runs a geo-core program with the dashboard's services, as a result. */
function runGeo<A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof geoCoreDashboardLayer>>
) {
  return Effect.runPromise(
    Effect.result(effect.pipe(Effect.provide(geoCoreDashboardLayer)))
  );
}

/**
 * Adds a product for an agent; prompts without a product that fit it are filed
 * into it. Shared by the dashboard chat and Notra's agent in Slack, which
 * reaches it through `/api/internal/geo/product-create`.
 */
export async function createGeoProductForAgent(
  input: GeoProductCreatorInput
): Promise<{ outcome: GeoProductCreateOutcome; httpStatus: number }> {
  const scope = {
    organizationId: input.organizationId,
    projectId: input.projectId,
  };
  const created = await runGeo(
    createGeoProduct({ ...scope, name: input.name, niche: input.niche })
  );
  if (created._tag === "Success") {
    const { product, sortedPrompts } = created.success;
    return {
      outcome: {
        status: "created",
        product: { id: product.id, name: product.name, niche: product.niche },
        sortedPrompts,
      },
      httpStatus: 200,
    };
  }
  switch (created.failure._tag) {
    case "GeoProductDuplicateError": {
      const listed = await runGeo(listGeoProducts(scope));
      const existing =
        listed._tag === "Success"
          ? listed.success.products.find(
              (product) =>
                product.name.toLowerCase() === input.name.trim().toLowerCase()
            )
          : undefined;
      return existing
        ? {
            outcome: {
              status: "exists",
              product: {
                id: existing.id,
                name: existing.name,
                niche: existing.niche,
              },
            },
            httpStatus: 200,
          }
        : {
            outcome: {
              status: "error",
              error: "The project already has a product with that name.",
            },
            httpStatus: 200,
          };
    }
    case "GeoProductLimitError":
      return {
        outcome: {
          status: "error",
          error: `The project already has the maximum of ${GEO_PRODUCTS_MAX} products.`,
        },
        httpStatus: 200,
      };
    case "GeoProjectNotFoundError":
      return {
        outcome: { status: "error", error: PROJECT_NOT_FOUND },
        httpStatus: 404,
      };
    default:
      return {
        outcome: {
          status: "error",
          error: "The product couldn't be created. Try again in a moment.",
        },
        httpStatus: 503,
      };
  }
}

/** The chat's `createGeoProduct` dependency. */
export async function createGeoProductForChat(
  input: GeoProductCreatorInput
): Promise<GeoProductCreateOutcome> {
  return (await createGeoProductForAgent(input)).outcome;
}

/**
 * Moves the tracked prompts an agent names, by id or wording, into a product
 * by name, or out of their product. Prompts that match nothing, several
 * prompts or an auto prompt come back unmoved with the reason. Shared like
 * `createGeoProductForAgent`, through `/api/internal/geo/prompts-move`.
 */
export async function moveGeoPromptsForAgent(
  input: GeoPromptMoverInput
): Promise<{ outcome: GeoPromptMoveOutcome; httpStatus: number }> {
  const scope = {
    organizationId: input.organizationId,
    projectId: input.projectId,
  };
  const [products, prompts] = await Promise.all([
    runGeo(listGeoProducts(scope)),
    runGeo(listGeoPrompts(scope)),
  ]);
  if (products._tag === "Failure" || prompts._tag === "Failure") {
    const notFound = [products, prompts].some(
      (result) =>
        result._tag === "Failure" &&
        result.failure._tag === "GeoProjectNotFoundError"
    );
    return {
      outcome: {
        status: "error",
        error: notFound
          ? PROJECT_NOT_FOUND
          : "The project's prompts couldn't be loaded.",
      },
      httpStatus: notFound ? 404 : 503,
    };
  }

  const wanted = input.product?.trim().toLowerCase() ?? null;
  const product =
    wanted === null
      ? null
      : products.success.products.find(
          (entry) => entry.name.toLowerCase() === wanted
        );
  if (product === undefined) {
    return {
      outcome: {
        status: "error",
        error: `The project has no product named "${input.product}".`,
        products: products.success.products.map((entry) => entry.name),
      },
      httpStatus: 200,
    };
  }

  const moved: { id: string; prompt: string }[] = [];
  const unmatched: Extract<
    GeoPromptMoveOutcome,
    { status: "moved" }
  >["unmatched"] = [];
  const handled = new Set<string>();
  for (const query of input.prompts) {
    // Paused prompts can move too; only scans need enabled ones.
    const match = matchTrackedPrompt(prompts.success.prompts, query);
    if (match.status !== "match") {
      unmatched.push(
        match.status === "choose"
          ? {
              prompt: query,
              reason: "Fits several tracked prompts.",
              choices: match.prompts,
            }
          : { prompt: query, reason: "No tracked prompt matches." }
      );
      continue;
    }
    const target = match.prompt;
    if (handled.has(target.id)) {
      continue;
    }
    handled.add(target.id);
    if (target.source === "auto") {
      unmatched.push({
        prompt: target.prompt,
        reason:
          "Auto prompts from the brand settings can't belong to a product.",
      });
      continue;
    }
    if ((target.productId ?? null) !== (product?.id ?? null)) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each update locks the project, so they run one at a time anyway
      const updated = await runGeo(
        updateGeoPrompt(scope, target.id, { productId: product?.id ?? null })
      );
      if (updated._tag === "Failure") {
        unmatched.push({
          prompt: target.prompt,
          reason: "The prompt couldn't be moved. Try again in a moment.",
        });
        continue;
      }
    }
    moved.push({ id: target.id, prompt: target.prompt });
  }

  if (moved.length > 0) {
    await runGeo(refreshGeoContentGapsBestEffort(scope));
  }
  return {
    outcome: {
      status: "moved",
      product: product?.name ?? null,
      moved,
      unmatched,
    },
    httpStatus: 200,
  };
}

/** The chat's `moveGeoPrompts` dependency. */
export async function moveGeoPromptsForChat(
  input: GeoPromptMoverInput
): Promise<GeoPromptMoveOutcome> {
  return (await moveGeoPromptsForAgent(input)).outcome;
}

/** Finds a project's product by name, or the error listing the real ones. */
async function findProductByName(
  scope: { organizationId: string; projectId?: string },
  name: string
) {
  const listed = await runGeo(listGeoProducts(scope));
  if (listed._tag === "Failure") {
    const notFound = listed.failure._tag === "GeoProjectNotFoundError";
    return {
      ok: false as const,
      outcome: {
        status: "error" as const,
        error: notFound
          ? PROJECT_NOT_FOUND
          : "The project's products couldn't be loaded.",
      },
      httpStatus: notFound ? 404 : 503,
    };
  }
  const wanted = name.trim().toLowerCase();
  const product = listed.success.products.find(
    (entry) => entry.name.toLowerCase() === wanted
  );
  if (!product) {
    return {
      ok: false as const,
      outcome: {
        status: "error" as const,
        error: `The project has no product named "${name}".`,
        products: listed.success.products.map((entry) => entry.name),
      },
      httpStatus: 200,
    };
  }
  return { ok: true as const, product };
}

/** Renames a product or changes its niche for an agent, by its name. */
export async function updateGeoProductForAgent(
  input: GeoProductUpdaterInput
): Promise<{ outcome: GeoProductUpdateOutcome; httpStatus: number }> {
  const scope = {
    organizationId: input.organizationId,
    projectId: input.projectId,
  };
  const found = await findProductByName(scope, input.product);
  if (!found.ok) {
    return { outcome: found.outcome, httpStatus: found.httpStatus };
  }
  const updated = await runGeo(
    updateGeoProduct({
      ...scope,
      productId: found.product.id,
      name: input.name,
      niche: input.niche,
    })
  );
  if (updated._tag === "Success") {
    const { id, name, niche } = updated.success;
    return {
      outcome: { status: "updated", product: { id, name, niche } },
      httpStatus: 200,
    };
  }
  return updated.failure._tag === "GeoProductDuplicateError"
    ? {
        outcome: {
          status: "error",
          error: `Another product is already named "${updated.failure.name}".`,
        },
        httpStatus: 200,
      }
    : {
        outcome: {
          status: "error",
          error: "The product couldn't be updated. Try again in a moment.",
        },
        httpStatus: 503,
      };
}

/** The chat's `updateGeoProduct` dependency. */
export async function updateGeoProductForChat(
  input: GeoProductUpdaterInput
): Promise<GeoProductUpdateOutcome> {
  return (await updateGeoProductForAgent(input)).outcome;
}

/** Deletes a product for an agent, by its name; its prompts are re-filed. */
export async function deleteGeoProductForAgent(
  input: GeoProductDeleterInput
): Promise<{ outcome: GeoProductDeleteOutcome; httpStatus: number }> {
  const scope = {
    organizationId: input.organizationId,
    projectId: input.projectId,
  };
  const found = await findProductByName(scope, input.product);
  if (!found.ok) {
    return { outcome: found.outcome, httpStatus: found.httpStatus };
  }
  const deleted = await runGeo(
    deleteGeoProduct({ ...scope, productId: found.product.id })
  );
  if (deleted._tag === "Failure") {
    return {
      outcome: {
        status: "error",
        error: "The product couldn't be deleted. Try again in a moment.",
      },
      httpStatus: 503,
    };
  }
  await runGeo(refreshGeoContentGapsBestEffort(scope));
  return {
    outcome: {
      status: "deleted",
      product: found.product.name,
      ...deleted.success,
    },
    httpStatus: 200,
  };
}

/** The chat's `deleteGeoProduct` dependency. */
export async function deleteGeoProductForChat(
  input: GeoProductDeleterInput
): Promise<GeoProductDeleteOutcome> {
  return (await deleteGeoProductForAgent(input)).outcome;
}
