import type { GscContextProject } from "../types/google-search-console";

/** Optional context must have one real project covered by the selected property. */
export function selectGscContextProject(
  siteUrl: string,
  projects: GscContextProject[]
): string | null {
  const matches = projects.filter((project) => {
    if (project.isSample) {
      return false;
    }
    try {
      const website = new URL(project.websiteUrl);
      if (website.protocol !== "https:" && website.protocol !== "http:") {
        return false;
      }
      if (siteUrl.startsWith("sc-domain:")) {
        const domain = siteUrl
          .slice("sc-domain:".length)
          .trim()
          .toLowerCase()
          .replace(/\.$/, "");
        const hostname = website.hostname.toLowerCase().replace(/\.$/, "");
        return (
          domain.length > 0 &&
          (hostname === domain || hostname.endsWith(`.${domain}`))
        );
      }
      const property = new URL(siteUrl);
      return (
        property.origin === website.origin &&
        website.href.startsWith(property.href)
      );
    } catch {
      return false;
    }
  });
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}
