import type { FieldScore } from "../types/eval";
import type { ChoiceWeights } from "./jev-judge";

const WHAT_COUNTS =
  "Claims are statements of fact about the product or the change: features, behaviour, causes, numbers, limits, prices, platforms, availability and dates. These are not claims and never count against post: opinions, jokes, tone, calls to action, translations, links to the repository, pull requests or releases in sourceData, and conclusions that follow directly from sourceData (arithmetic on its numbers, a public URL being reachable by anyone, merchants who were not contacted being unaffected). PR diff stats and authors are part of sourceData.";

/** The question every content suite used before 2026-11-07, kept for judge-check. */
export const LEGACY_GROUNDED_QUESTION = {
  type: "boolean",
  instructions:
    "Is every factual claim in post supported by sourceData? Product names, numbers, features and fixes must appear in sourceData. Style and opinions do not count as claims.",
} as const;

export const GROUNDED_BOOLEAN_QUESTION = {
  type: "boolean",
  instructions: `Is every claim in post supported by sourceData? ${WHAT_COUNTS}`,
  criteria: {
    true: "No claim is missing from or contradicted by sourceData",
    false:
      "At least one claim adds a feature, number, behaviour, cause, platform or limit that sourceData does not support",
  },
} as const;

export const GROUNDING_SEVERITY_QUESTION = {
  type: "choice",
  instructions: `Find the least supported claim in post and classify it. ${WHAT_COUNTS}`,
  criteria: {
    contradicts: "A claim contradicts sourceData",
    unsupported:
      "A claim adds a feature, number, behaviour, cause, platform or limit that sourceData does not state and that does not follow from it",
    inference:
      "Every claim is stated in sourceData or follows directly from it",
    supported: "Every claim is stated in sourceData",
  },
} as const;

export const GROUNDING_SEVERITY_WEIGHTS: ChoiceWeights = {
  grounding: { contradicts: 0, unsupported: 0.1, inference: 0.9, supported: 1 },
};

export const UNSUPPORTED_COUNT_QUESTION = {
  type: "score",
  instructions: `How many claims in post are not supported by sourceData? ${WHAT_COUNTS}`,
  criteria: ["Four or more", "Two or three", "One", "None"],
} as const;

/** The question content suites score with. Chosen with `bun run evals judge-check`. */
export const GROUNDED_QUESTION = GROUNDED_BOOLEAN_QUESTION;

/**
 * Judge probabilities for accurate posts sit well below 1, so 0.5 flags many
 * of them. This cut separates the labelled set in judge-check; re-check it
 * whenever the question, its context or the judge model changes.
 */
export const GROUNDED_THRESHOLD = 0.25;

/** 1 when the post has no invented claims, 0 otherwise; the raw probability is kept in the note. */
export function groundedField(probability: number, weight: number): FieldScore {
  return {
    field: "grounded",
    score: probability >= GROUNDED_THRESHOLD ? 1 : 0,
    note: `judge ${probability.toFixed(2)}`,
    weight,
  };
}
