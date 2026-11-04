export const GITHUB_APP_REPOSITORIES_CACHE_TTL_SECONDS = 15 * 60;
export const GITHUB_APP_REPOSITORIES_STALE_CACHE_TTL_SECONDS = 24 * 60 * 60;
/** Pages of 100 org memberships read when looking for linkable installations. */
export const GITHUB_MEMBERSHIP_PAGE_LIMIT = 10;
/** GitHub installation lookups in flight at once per install click. */
export const GITHUB_INSTALLATION_LOOKUP_CONCURRENCY = 8;
export const GITHUB_OAUTH_AUTHORIZE_URL =
  "https://github.com/login/oauth/authorize";
export const GITHUB_OAUTH_TOKEN_URL =
  "https://github.com/login/oauth/access_token";
/** Prefix of user tokens issued by a GitHub App, which carry no OAuth scopes. */
export const GITHUB_APP_USER_TOKEN_PREFIX = "ghu_";
