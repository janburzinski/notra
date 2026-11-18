import { db } from "@notra/db/drizzle";
import { geoPrompts, geoPromptSuggestions } from "@notra/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import { GeoSuggestionNotFoundError } from "../schemas/suggestion-errors";
import type { DbTransaction } from "../types/db";
import type { GeoPromptRow, GeoScopeInput } from "../types/geo";
import type {
  GeoSuggestionInput,
  GeoSuggestionRow,
} from "../types/suggestions";
import { geoDb, geoSkip } from "./effect";
import { GeoDatabaseError } from "./errors";
import { lockGeoProjectInTransaction } from "./lock";
import { toTrackedPrompt } from "./mappers";
import { reloadSortedPrompt, sortNewPromptsIntoProducts } from "./product-sort";
import { toggleGeoPrompt } from "./programs";
import { requireGeoProject } from "./projects";
import { promptKey } from "./prompt-key";
import { pickNewGeoPrompts } from "./prompt-translations";
import { customPromptScanId } from "./prompts";

export const listSuggestions = Effect.fn("geo.suggestions.list")(function* (
  input: GeoScopeInput
) {
  const scope = yield* requireGeoProject(input);
  const rows = yield* geoDb("list suggestions", () =>
    db.query.geoPromptSuggestions.findMany({
      where: and(
        eq(geoPromptSuggestions.organizationId, input.organizationId),
        eq(geoPromptSuggestions.projectId, scope.projectId),
        eq(geoPromptSuggestions.status, "pending"),
        eq(geoPromptSuggestions.source, "search_console")
      ),
      orderBy: [desc(geoPromptSuggestions.createdAt)],
    })
  );
  return {
    suggestions: rows.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      title: row.title,
      source: "search_console" as const,
      keywords: row.sourceKeywords,
      createdAt: row.createdAt.toISOString(),
    })),
  };
});

/**
 * A suggestion that matches a prompt the project already tracks fills in the
 * product and intent that prompt is missing; set values are never overwritten.
 */
async function adoptSuggestionDetails(
  tx: DbTransaction,
  existing: GeoPromptRow,
  suggestion: GeoSuggestionRow
) {
  const productId = existing.productId ?? suggestion.productId;
  const intent = existing.intent ?? suggestion.intent;
  if (productId === existing.productId && intent === existing.intent) {
    return existing;
  }
  const [updated] = await tx
    .update(geoPrompts)
    .set({ productId, intent })
    .where(eq(geoPrompts.id, existing.id))
    .returning();
  return updated ?? existing;
}

async function acceptSuggestionInTx(
  tx: DbTransaction,
  organizationId: string,
  projectId: string,
  suggestion: GeoSuggestionRow,
  /** Collects ids of prompts this call created, not reused. */
  created: string[] = []
) {
  const existing = await tx.query.geoPrompts.findFirst({
    where: and(
      eq(geoPrompts.organizationId, organizationId),
      eq(geoPrompts.projectId, projectId),
      sql`lower(trim(${geoPrompts.prompt})) = ${promptKey(suggestion.prompt)}`
    ),
  });
  const prompt = existing
    ? await adoptSuggestionDetails(tx, existing, suggestion)
    : (
        await tx
          .insert(geoPrompts)
          .values({
            id: crypto.randomUUID(),
            organizationId,
            projectId,
            prompt: suggestion.prompt,
            title: suggestion.title,
            // Product suggestions get their product's badge right away.
            productId: suggestion.productId,
            intent: suggestion.intent,
          })
          .returning()
      )[0];
  if (!prompt) {
    throw new Error("Failed to create suggestion prompt");
  }
  if (!existing) {
    created.push(prompt.id);
  }
  await tx
    .update(geoPromptSuggestions)
    .set({ status: "accepted", acceptedPromptId: prompt.id })
    .where(
      and(
        eq(geoPromptSuggestions.id, suggestion.id),
        eq(geoPromptSuggestions.organizationId, organizationId),
        eq(geoPromptSuggestions.projectId, projectId),
        eq(geoPromptSuggestions.status, "pending")
      )
    );
  return toTrackedPrompt(prompt);
}

/**
 * Gives newly tracked prompts their slot in languages that already have saved
 * picks, like `createGeoPrompt` does; a failed pick never fails tracking.
 */
const pickTrackedSuggestions = (
  input: GeoScopeInput,
  promptIds: readonly string[]
) =>
  pickNewGeoPrompts(input, promptIds.map(customPromptScanId)).pipe(
    geoSkip("prompt translation pick failed")
  );

/** Autopilot's pending changes to tracked prompts, e.g. pausing a dead prompt. */
export const listAutopilotPromptSuggestions = Effect.fn(
  "geo.suggestions.listAutopilot"
)(function* (input: GeoScopeInput) {
  const scope = yield* requireGeoProject(input);
  const rows = yield* geoDb("list autopilot suggestions", () =>
    db.query.geoPromptSuggestions.findMany({
      where: and(
        eq(geoPromptSuggestions.organizationId, input.organizationId),
        eq(geoPromptSuggestions.projectId, scope.projectId),
        eq(geoPromptSuggestions.status, "pending"),
        eq(geoPromptSuggestions.source, "autopilot")
      ),
      orderBy: [desc(geoPromptSuggestions.createdAt)],
    })
  );
  return {
    suggestions: rows.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      action: row.action,
      targetPromptId: row.targetPromptId,
      reason: row.reason,
      reasonData: row.reasonData,
      createdAt: row.createdAt.toISOString(),
    })),
  };
});

/**
 * Pause suggestions act on an existing prompt instead of adding one. The
 * suggestion is claimed first (pending → accepted), so a parallel "Keep"
 * either wins or loses cleanly; a failed pause puts it back.
 */
const acceptPauseSuggestion = Effect.fn("geo.suggestions.acceptPause")(
  function* (input: GeoSuggestionInput, projectId: string) {
    const scoped = and(
      eq(geoPromptSuggestions.id, input.suggestionId),
      eq(geoPromptSuggestions.organizationId, input.organizationId),
      eq(geoPromptSuggestions.projectId, projectId)
    );
    const [suggestion] = yield* geoDb("claim pause suggestion", () =>
      db
        .update(geoPromptSuggestions)
        .set({ status: "accepted" })
        .where(
          and(
            scoped,
            eq(geoPromptSuggestions.status, "pending"),
            eq(geoPromptSuggestions.action, "pause")
          )
        )
        .returning()
    );
    if (!suggestion) {
      return null;
    }
    const targetPromptId = suggestion.targetPromptId;
    const prompt = targetPromptId
      ? yield* toggleGeoPrompt(input, targetPromptId, false).pipe(
          // The prompt was deleted in the meantime: nothing left to pause.
          Effect.catchTag("GeoPromptNotFoundError", () => Effect.succeed(null)),
          Effect.tapError(() =>
            geoDb("release pause suggestion", () =>
              db
                .update(geoPromptSuggestions)
                .set({ status: "pending" })
                .where(scoped)
            )
          )
        )
      : null;
    if (!prompt) {
      yield* geoDb("retire pause suggestion", () =>
        db
          .update(geoPromptSuggestions)
          .set({ status: "dismissed" })
          .where(scoped)
      );
      return yield* Effect.fail(
        new GeoSuggestionNotFoundError({ suggestionId: input.suggestionId })
      );
    }
    return { projectId, prompt, suggestion };
  }
);

export const acceptSuggestion = Effect.fn("geo.suggestions.accept")(function* (
  input: GeoSuggestionInput
) {
  const { projectId } = yield* requireGeoProject(input);
  const paused = yield* acceptPauseSuggestion(input, projectId);
  if (paused) {
    return paused;
  }
  const created: string[] = [];
  const accepted = yield* Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        await lockGeoProjectInTransaction(tx, projectId);
        const [suggestion] = await tx
          .select()
          .from(geoPromptSuggestions)
          .where(
            and(
              eq(geoPromptSuggestions.id, input.suggestionId),
              eq(geoPromptSuggestions.organizationId, input.organizationId),
              eq(geoPromptSuggestions.projectId, projectId),
              eq(geoPromptSuggestions.status, "pending")
            )
          )
          .for("update");
        if (!suggestion) {
          throw new GeoSuggestionNotFoundError({
            suggestionId: input.suggestionId,
          });
        }
        const prompt = await acceptSuggestionInTx(
          tx,
          input.organizationId,
          projectId,
          suggestion,
          created
        );
        return { projectId, prompt, suggestion };
      }),
    catch: (cause) =>
      cause instanceof GeoSuggestionNotFoundError
        ? cause
        : new GeoDatabaseError({ label: "accept suggestion", cause }),
  });
  yield* pickTrackedSuggestions(input, created);
  // Search Console and Autopilot suggestions come without a product. A
  // reused prompt keeps the product (or none) its owner already chose.
  if (accepted.prompt.productId || !created.includes(accepted.prompt.id)) {
    return accepted;
  }
  const sorted = yield* sortNewPromptsIntoProducts(
    input.organizationId,
    projectId,
    [accepted.prompt.id]
  );
  const saved =
    sorted > 0 ? yield* reloadSortedPrompt(accepted.prompt.id) : undefined;
  return saved ? { ...accepted, prompt: toTrackedPrompt(saved) } : accepted;
});

export const acceptAllSuggestions = Effect.fn("geo.suggestions.acceptAll")(
  function* (input: GeoScopeInput) {
    const { projectId } = yield* requireGeoProject(input);
    const pending = yield* geoDb("check pending suggestions", () =>
      db.query.geoPromptSuggestions.findFirst({
        columns: { id: true },
        where: and(
          eq(geoPromptSuggestions.organizationId, input.organizationId),
          eq(geoPromptSuggestions.projectId, projectId),
          eq(geoPromptSuggestions.status, "pending"),
          eq(geoPromptSuggestions.source, "search_console")
        ),
      })
    );
    if (!pending) {
      return { projectId, suggestions: [], accepted: 0 };
    }
    const created: string[] = [];
    const result = yield* geoDb("accept all suggestions", () =>
      db.transaction(async (tx) => {
        await lockGeoProjectInTransaction(tx, projectId);
        const suggestions = await tx
          .select()
          .from(geoPromptSuggestions)
          .where(
            and(
              eq(geoPromptSuggestions.organizationId, input.organizationId),
              eq(geoPromptSuggestions.projectId, projectId),
              eq(geoPromptSuggestions.status, "pending"),
              // "Track all" covers the Search Console list; Autopilot's
              // prompt changes are always accepted one by one.
              eq(geoPromptSuggestions.source, "search_console")
            )
          )
          .orderBy(
            asc(geoPromptSuggestions.createdAt),
            asc(geoPromptSuggestions.id)
          )
          .for("update");
        const promptIds: string[] = [];
        for (const row of suggestions) {
          const prompt = await acceptSuggestionInTx(
            tx,
            input.organizationId,
            projectId,
            row,
            created
          );
          if (!prompt.productId) {
            promptIds.push(prompt.id);
          }
        }
        return {
          projectId,
          suggestions,
          accepted: suggestions.length,
          promptIds,
        };
      })
    );
    const { promptIds, ...accepted } = result;
    yield* pickTrackedSuggestions(input, created);
    // Only prompts this call created; reused ones keep their owner's choice.
    yield* sortNewPromptsIntoProducts(
      input.organizationId,
      projectId,
      promptIds.filter((id) => created.includes(id))
    );
    return accepted;
  }
);

export const dismissSuggestion = Effect.fn("geo.suggestions.dismiss")(
  function* (input: GeoSuggestionInput) {
    const { projectId } = yield* requireGeoProject(input);
    const [row] = yield* geoDb("dismiss suggestion", () =>
      db
        .update(geoPromptSuggestions)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(geoPromptSuggestions.id, input.suggestionId),
            eq(geoPromptSuggestions.organizationId, input.organizationId),
            eq(geoPromptSuggestions.projectId, projectId),
            eq(geoPromptSuggestions.status, "pending")
          )
        )
        .returning({ id: geoPromptSuggestions.id })
    );
    if (!row) {
      return yield* Effect.fail(
        new GeoSuggestionNotFoundError({ suggestionId: input.suggestionId })
      );
    }
    return { dismissed: true, suggestionId: row.id };
  }
);
