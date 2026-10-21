import type { SiteValidationQuery } from "@/types/sites";

export function siteValidationReady(query: SiteValidationQuery): boolean {
  return query.isSuccess && !query.isPlaceholderData && query.data?.ok === true;
}
