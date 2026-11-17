export const GEO_PROJECT_CREATE_TIMEOUT_MS = 10 * 60 * 1000;

/** geo-db collections that setting up GEO on a project fills. */
export const GEO_SETUP_DB_COLLECTIONS = [
  "prompts",
  "competitors",
  "sequences",
] as const;
