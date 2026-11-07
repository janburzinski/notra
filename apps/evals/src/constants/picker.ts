export const MIN_CASES = 5;
export const MAX_ERROR_RATE = 0.1;
/** A pick may not pass this many fewer cases than the production model. */
export const MAX_PASS_RATE_DROP = 0.1;
/** A pick may not ground this many fewer posts than the production model. */
export const MAX_GROUNDED_DROP = 0.05;
/** Float slack so a drop of exactly the limit is allowed. */
export const DROP_EPSILON = 1e-9;

export const DEFAULT_VOLUME = 1000;

export const COST_INCLUDED_IN: Readonly<Record<string, string>> = {
  "content-draft": "content-agent",
  "content-unslop": "content-agent",
};
