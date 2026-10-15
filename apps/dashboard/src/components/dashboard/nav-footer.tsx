"use client";

import {
  BookOpen01Icon,
  Robot01Icon,
  SearchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Kbd, KbdGroup } from "@notra/ui/components/ui/kbd";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@notra/ui/components/ui/sidebar";
import { useIsApplePlatform } from "@notra/ui/hooks/use-is-apple-platform";
import { useTranslations } from "use-intl";

import { useCommandPalette } from "@/components/command-palette/command-palette-context";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { NAV_WORKSPACE_GROUP } from "@/constants/nav";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";

import { NavGroupList } from "./nav-group-list";
import { useActiveNavLink } from "./nav-jobs";
import { SidebarLabel } from "./sidebar-label";

const DOCS_URL = "https://www.usenotra.com/docs";
const WORKSPACE_GROUPS = [NAV_WORKSPACE_GROUP];

export function NavFooter({ slug }: { slug: string }) {
  const tCommon = useTranslations("common.labels");
  const tActions = useTranslations("common.actions");
  const isApplePlatform = useIsApplePlatform();
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();
  const visibility = useNavVisibility();
  const [projectParam] = useGeoProjectQueryState();
  const { active, togglePanel } = useRightPanel();
  const activeLink = useActiveNavLink(slug);
  const agentLabel = tCommon("agent");
  const docsLabel = tCommon("docs");
  const searchLabel = tActions("search");

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="cursor-pointer"
            onClick={() => setCommandPaletteOpen(true)}
            tooltip={searchLabel}
          >
            <HugeiconsIcon icon={SearchIcon} />
            <SidebarLabel>{searchLabel}</SidebarLabel>
            <KbdGroup className="ml-auto group-data-[collapsible=icon]:hidden">
              <Kbd>{isApplePlatform ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            aria-pressed={active === "agent"}
            className="cursor-pointer"
            onClick={() => togglePanel("agent")}
            tooltip={agentLabel}
          >
            <HugeiconsIcon icon={Robot01Icon} />
            <SidebarLabel>{agentLabel}</SidebarLabel>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <NavGroupList
        activeLink={activeLink}
        groups={WORKSPACE_GROUPS}
        projectId={projectParam ?? undefined}
        slug={slug}
        visibility={visibility}
      />
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={
              <a href={DOCS_URL} rel="noopener" target="_blank">
                <HugeiconsIcon icon={BookOpen01Icon} />
                <SidebarLabel>{docsLabel}</SidebarLabel>
              </a>
            }
            tooltip={docsLabel}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
