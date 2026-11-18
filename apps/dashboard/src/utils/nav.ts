import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import {
  DEFAULT_NAV_VISIBILITY,
  GEO_OVERVIEW_NAV_LINK,
  NAV_GEO_IMPROVE_LINKS,
  NAV_MAIN_ITEMS,
} from "@/constants/nav";
import { SITES_NAV_LINK } from "@/constants/sites";
import type {
  NavGroup,
  NavGroupRowState,
  NavMainItem,
  NavVisibility,
} from "@/types/components/nav";
import type { SettingsUrlSearchParams } from "@/types/settings/modal";

const NAV_ITEMS_BY_LINK = new Map(
  NAV_MAIN_ITEMS.map((item) => [item.link, item])
);

/** The org root has no page of its own; it opens the overview, keeping the query. */
export function orgRootRedirectHref(
  slug: string,
  searchParams: SettingsUrlSearchParams = {}
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        query.append(key, item);
      }
    }
  }
  const path = `/${slug}${GEO_OVERVIEW_NAV_LINK}`;
  return query.size ? `${path}?${query}` : path;
}

export function resolveNavGroupRow(
  group: NavGroup,
  first: NavMainItem,
  rest: readonly NavMainItem[],
  activeLink: string | null
): NavGroupRowState {
  const listsOwnPage = group.listsOwnPage || first.link !== group.links[0];
  const subRows = listsOwnPage
    ? [first, ...rest].toSorted(
        (a, b) => group.links.indexOf(a.link) - group.links.indexOf(b.link)
      )
    : [...rest];
  const groupActive =
    first.link === activeLink || rest.some((item) => item.link === activeLink);
  return {
    subRows,
    groupActive,
    ownPageActive: first.link === activeLink && !listsOwnPage,
    showSubRows: groupActive && subRows.length > 0,
    // A row with one page is that page, so it carries the page's badge.
    showOwnBadge: rest.length === 0 && !listsOwnPage,
  };
}

export function resolveNavItems(
  links: readonly string[],
  visibility: NavVisibility = DEFAULT_NAV_VISIBILITY
): NavMainItem[] {
  const items: NavMainItem[] = [];
  for (const link of links) {
    const item = NAV_ITEMS_BY_LINK.get(link);
    if (item) {
      items.push(item);
    }
  }
  const withSites = visibility.sites
    ? items
    : items.filter((item) => item.link !== SITES_NAV_LINK);
  return visibility.autopilot
    ? withSites
    : withSites.filter((item) => item.link !== AUTOPILOT_NAV_LINK);
}

export function resolveActiveNavLink(
  pathname: string,
  slug: string,
  links: readonly string[]
): string | null {
  const root = `/${slug}`;
  let active: string | null = null;
  for (const link of links) {
    const href = `${root}${link}`;
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (active === null || link.length > active.length)) {
      active = link;
    }
  }
  return active;
}
