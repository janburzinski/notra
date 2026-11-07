/**
 * The workspace slug for the composer's upgrade link. Only the usage limit
 * offers one: any other error leaves it out.
 */
export function upgradeLinkSlug(
  error: string | null,
  usageLimitMessage: string,
  organizationSlug: string
) {
  return error && error !== usageLimitMessage ? "" : organizationSlug;
}
