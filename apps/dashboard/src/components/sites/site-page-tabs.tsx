"use client";

import {
  PlusSignIcon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { cn } from "@notra/ui/lib/utils";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { ProjectLogo } from "@/components/geo/project-logo";
import {
  SITE_NAV_SECTIONS,
  SITE_SECTIONS,
  SITES_NAV_LINK,
} from "@/constants/sites";
import { useSitesList } from "@/lib/hooks/use-sites";
import { usePathname, useRouter } from "@/lib/navigation";
import type {
  SitePageTabsProps,
  SiteSwitcherProps,
} from "@/types/components/sites";
import type { SiteSection } from "@/types/sites";
import { displayUrl, siteHref } from "@/utils/site-links";

const TAB_SECTIONS = SITE_SECTIONS.filter((item) =>
  SITE_NAV_SECTIONS.has(item.section)
);

function siteDomain(origin: string): string {
  return displayUrl(origin).split("/")[0] ?? "";
}

/** Pages without a tab highlight the tab that links to them. */
function tabSection(section: SiteSection): SiteSection {
  if (SITE_NAV_SECTIONS.has(section)) {
    return section;
  }
  return section === "integrations" ? "settings" : "overview";
}

function SiteSwitcher({
  slug,
  organizationId,
  site,
  section,
}: SiteSwitcherProps) {
  const t = useTranslations("sites.switcher");
  const router = useRouter();
  const { data } = useSitesList(organizationId, site.projectId);
  const sites = data?.sites ?? [site];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label={t("label", { name: site.name })}
            className="hover:bg-muted focus-visible:ring-ring/50 -ml-2 flex h-8 max-w-64 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none focus-visible:ring-3"
            type="button"
          >
            <ProjectLogo
              domain={siteDomain(site.publicOrigin)}
              name={site.name}
            />
            <span className="truncate">{site.name}</span>
            <HugeiconsIcon
              className="text-muted-foreground size-3.5 shrink-0"
              icon={UnfoldMoreIcon}
            />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-60" sideOffset={4}>
        <DropdownMenuGroup>
          {sites.map((item) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={item.id}
              onClick={() => {
                if (item.id !== site.id) {
                  router.push(siteHref(slug, item.id, section));
                }
              }}
            >
              <ProjectLogo
                domain={siteDomain(item.publicOrigin)}
                name={item.name}
              />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {displayUrl(item.liveUrl)}
                </span>
              </span>
              {item.id === site.id ? (
                <HugeiconsIcon
                  className="text-muted-foreground size-4"
                  icon={Tick02Icon}
                />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push(`/${slug}${SITES_NAV_LINK}/new`)}
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          {t("newSite")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Site switcher and the site's pages in one bar, pinned above every site page. */
export function SitePageTabs({
  slug,
  organizationId,
  site,
}: SitePageTabsProps) {
  const t = useTranslations("sites.detail.tabs");
  const pathname = usePathname();
  const rest = pathname.slice(siteHref(slug, site.id).length);
  const current =
    SITE_SECTIONS.find(
      (item) =>
        item.path && (rest === item.path || rest.startsWith(`${item.path}/`))
    )?.section ?? "overview";
  const section = tabSection(current);
  const navRef = useRef<HTMLElement>(null);
  // Narrow screens scroll the tabs; keep the current one in view.
  useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!(nav && tab)) {
      return;
    }
    const right = tab.offsetLeft + tab.offsetWidth - nav.clientWidth;
    if (nav.scrollLeft < right || nav.scrollLeft > tab.offsetLeft) {
      nav.scrollLeft = Math.max(0, right);
    }
  }, [section]);
  return (
    <div className="bg-background sticky top-0 z-20 border-b">
      <div className="flex h-12 items-stretch gap-2 px-4 lg:px-5">
        <div className="flex shrink-0 items-center">
          <SiteSwitcher
            organizationId={organizationId}
            section={section}
            site={site}
            slug={slug}
          />
        </div>
        <span
          aria-hidden="true"
          className="bg-border my-auto h-4 w-px shrink-0"
        />
        <nav
          aria-label={t("label")}
          className="relative -mb-px flex min-w-0 scrollbar-none overflow-x-auto"
          ref={navRef}
        >
          {TAB_SECTIONS.map((item) => {
            const active = item.section === section;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex shrink-0 items-center text-sm outline-none",
                  active
                    ? "text-foreground after:bg-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-px"
                    : "text-muted-foreground hover:text-foreground"
                )}
                exact={item.section === "overview"}
                href={siteHref(slug, site.id, item.section)}
                key={item.section}
              >
                <span className="group-hover:bg-muted group-focus-visible:ring-ring/50 rounded-md px-2.5 py-1 transition-colors group-focus-visible:ring-3">
                  {t(item.section)}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
