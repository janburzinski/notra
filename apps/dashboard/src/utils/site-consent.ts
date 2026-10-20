import { INTH_OAUTH_AUTHORIZE_PATH } from "@notra/sites-server/constants/inth";

import { INTH_OAUTH_ERRORS } from "@/constants/site-consent";
import type { InthOAuthErrorCode } from "@/types/site-consent";

export function inthAuthorizeHref(
  organizationId: string,
  callbackPath: string
): string {
  return `${INTH_OAUTH_AUTHORIZE_PATH}?${new URLSearchParams({
    organizationId,
    callbackPath,
  }).toString()}`;
}

export function inthOAuthError(
  value: string | null
): InthOAuthErrorCode | null {
  return INTH_OAUTH_ERRORS.find((code) => code === value) ?? null;
}

export function c15tConfigExample(backendURL: string): string {
  return JSON.stringify({ integrations: { c15t: { backendURL } } }, null, 2);
}
