export const EVAL_AUTOPILOT_ORGANIZATION_ID = "org_eval_autopilot";
export const EVAL_AUTOPILOT_ACTED_BY_OUTCOME = {
  open: "opened",
  suggest: "suggested",
} as const;

/** A brief topic phrased as a release note instead of a question people ask. */
export const EVAL_ANNOUNCEMENT_BRIEF =
  /^(introducing|announcing|new:|launch)|\bnow (supports?|lets|has|offers|available)\b|what'?s new|\b(ships?|launche[sd]|released?)\b/i;
