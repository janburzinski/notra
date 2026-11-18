export interface GeoAgentProduct {
  id: string;
  name: string;
  niche: string | null;
}

export interface GeoProductCreatorInput {
  organizationId: string;
  projectId?: string;
  name: string;
  niche?: string;
}

/**
 * created: the product exists now, and sortedPrompts prompts without a product
 * were filed into it. exists: the project already has a product with that
 * name, returned instead. error: the reason to pass on.
 */
export type GeoProductCreateOutcome =
  | { status: "created"; product: GeoAgentProduct; sortedPrompts: number }
  | { status: "exists"; product: GeoAgentProduct }
  | { status: "error"; error: string };

/** Creates a GEO product. Supplied by the host app, like the prompt finder. */
export type GeoProductCreator = (
  input: GeoProductCreatorInput
) => Promise<GeoProductCreateOutcome>;

export interface GeoPromptMoverInput {
  organizationId: string;
  projectId?: string;
  /** Prompt ids or wordings, as findGeoPrompts returns them. */
  prompts: string[];
  /** Product name, or null to take the prompts out of their product. */
  product: string | null;
}

/**
 * moved: the prompts in moved now belong to product (null: no product).
 * unmatched lists the ones that weren't moved and why, with prompts to choose
 * from when a wording fit several. error: nothing was moved; an unknown
 * product name lists the project's products.
 */
export type GeoPromptMoveOutcome =
  | {
      status: "moved";
      product: string | null;
      moved: { id: string; prompt: string }[];
      unmatched: {
        prompt: string;
        reason: string;
        choices?: { id: string; prompt: string }[];
      }[];
    }
  | { status: "error"; error: string; products?: string[] };

/** Moves tracked prompts into a product. Supplied by the host app. */
export type GeoPromptMover = (
  input: GeoPromptMoverInput
) => Promise<GeoPromptMoveOutcome>;

export interface GeoProductUpdaterInput {
  organizationId: string;
  projectId?: string;
  /** The product's current name. */
  product: string;
  name?: string;
  niche?: string | null;
}

export type GeoProductUpdateOutcome =
  | { status: "updated"; product: GeoAgentProduct }
  | { status: "error"; error: string; products?: string[] };

/** Renames a GEO product or changes its niche. Supplied by the host app. */
export type GeoProductUpdater = (
  input: GeoProductUpdaterInput
) => Promise<GeoProductUpdateOutcome>;

export interface GeoProductDeleterInput {
  organizationId: string;
  projectId?: string;
  /** The product's name. */
  product: string;
}

/**
 * deleted: the product is gone; its prompts lost their product and
 * refiledPrompts of them moved into another product that fits.
 */
export type GeoProductDeleteOutcome =
  | {
      status: "deleted";
      product: string;
      unfiledPrompts: number;
      refiledPrompts: number;
    }
  | { status: "error"; error: string; products?: string[] };

/** Deletes a GEO product. Supplied by the host app. */
export type GeoProductDeleter = (
  input: GeoProductDeleterInput
) => Promise<GeoProductDeleteOutcome>;
