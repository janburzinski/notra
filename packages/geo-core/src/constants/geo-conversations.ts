export const MAX_JUDGE_COMPETITORS = 10;

/**
 * How long a conversation or persona run holds its claim. Longer than any run
 * can take, so a run killed mid-way frees the claim on its own.
 */
export const GEO_CONVERSATION_RUN_CLAIM_TTL_SECONDS = 15 * 60;
