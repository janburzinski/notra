import { getOrganizationSlugFromPathname } from "@/utils/organization-pathname";

export function isContentDetailPathname(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  const organizationSlug = getOrganizationSlugFromPathname(pathname);
  if (!organizationSlug) {
    return false;
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments[1] === "content" && segments.length >= 3;
}

/**
 * Pages that name a single record (chat, post, collection, brand identity,
 * site) and need the topbar breadcrumbs to say which one. Every other page
 * titles itself.
 */
export function isRecordDetailPathname(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  const [slug, section, detail] = pathname.split("/").filter(Boolean);
  if (!slug || !section) {
    return false;
  }
  if (section === "brand") {
    return detail === "identity";
  }
  if (section === "sites") {
    return Boolean(detail?.startsWith("site_"));
  }
  return (
    (section === "chat" || section === "content" || section === "collection") &&
    Boolean(detail)
  );
}
