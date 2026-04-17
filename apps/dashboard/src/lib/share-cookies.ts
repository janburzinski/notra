export const SHARE_ACCESS_COOKIE_PREFIX = "share_access_";
export const SHARE_ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export function getShareAccessCookieName(token: string): string {
  return `${SHARE_ACCESS_COOKIE_PREFIX}${token}`;
}
