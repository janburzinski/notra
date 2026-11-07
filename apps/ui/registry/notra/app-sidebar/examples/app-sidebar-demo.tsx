import {
  BookOpen01Icon,
  Calendar03Icon,
  Logout01Icon,
  Message01Icon,
  PlusSignIcon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../dropdown-menu/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "../../sidebar/components/sidebar";
import { SidebarNav } from "../components/sidebar-nav";
import { SidebarSearch } from "../components/sidebar-search";
import {
  SidebarHeaderRow,
  SidebarSwitcher,
} from "../components/sidebar-switcher";
import { SidebarUserMenu } from "../components/sidebar-user-menu";
import {
  DEMO_AGENT_ICON_DOTS,
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_GROUPS,
  DEMO_PAGE_TITLES,
  DEMO_PROJECTS,
} from "../constants/app-sidebar-demo";
import { useScrollMore } from "../hooks/use-scroll-more";
import type { SidebarLinkRender } from "../types/app-sidebar";

// The preview frame is padded, so the sidebar sits in the shell instead of
// being fixed to the viewport as it is in an app.
const DEMO_SHELL_CLASS_NAME =
  "relative h-184 min-h-0 overflow-hidden [&_[data-slot=sidebar-container]]:absolute [&_[data-slot=sidebar-container]]:h-full";

const MENU_ITEM_CLASS_NAME = "cursor-pointer py-1.5";

function AgentIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      {DEMO_AGENT_ICON_DOTS.map(({ cx, cy, r }) => (
        <circle cx={cx} cy={cy} key={`${cx}-${cy}`} r={r} />
      ))}
    </svg>
  );
}

function MobileTrigger() {
  const { isMobile } = useSidebar();
  return isMobile ? <SidebarTrigger /> : null;
}

export default function AppSidebarDemo({
  defaultOpen = true,
  defaultHref = "#traffic",
}: {
  defaultOpen?: boolean;
  defaultHref?: string;
}) {
  const [project, setProject] = useState("notra");
  const [activeHref, setActiveHref] = useState(defaultHref);
  const scroll = useScrollMore<HTMLDivElement>();
  const linkRender: SidebarLinkRender = ({ children, ...props }) => (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        setActiveHref(props.href);
      }}
    >
      {children}
    </a>
  );

  return (
    <SidebarProvider
      className={DEMO_SHELL_CLASS_NAME}
      defaultOpen={defaultOpen}
      keyboardShortcut={null}
      mobileBreakpoint={480}
    >
      <Sidebar collapsible="icon" variant="inset" className="border-none">
        <SidebarHeader className="pt-px pb-0.5">
          <SidebarHeaderRow trigger={<SidebarTrigger />}>
            <SidebarSwitcher
              options={DEMO_PROJECTS}
              value={project}
              onValueChange={setProject}
              actions={
                <>
                  <DropdownMenuItem>
                    <HugeiconsIcon icon={PlusSignIcon} />
                    New project
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <HugeiconsIcon icon={Settings01Icon} />
                    Project settings
                  </DropdownMenuItem>
                </>
              }
            />
          </SidebarHeaderRow>
        </SidebarHeader>
        <div className="px-2 pt-2.5 pb-3">
          <SidebarSearch />
        </div>
        <SidebarContent ref={scroll.ref}>
          <SidebarGroup>
            <SidebarNav
              groups={DEMO_NAV_GROUPS}
              activeHref={activeHref}
              linkRender={linkRender}
            />
          </SidebarGroup>
          <SidebarGroup className="mt-auto gap-1 pb-0">
            <SidebarNav
              groups={DEMO_FOOTER_GROUPS}
              activeHref={activeHref}
              linkRender={linkRender}
            />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <a
                      href="https://docs.usenotra.com"
                      rel="noopener noreferrer"
                      target="_blank"
                    />
                  }
                  tooltip="Docs"
                >
                  <HugeiconsIcon icon={BookOpen01Icon} />
                  <span>Docs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <div className="pt-2">
              <Button
                aria-label="Ask agent"
                className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0"
                title="Ask agent"
                variant="outline"
              >
                <AgentIcon />
                <span className="group-data-[collapsible=icon]:hidden">
                  Ask agent
                </span>
              </Button>
            </div>
          </SidebarGroup>
        </SidebarContent>
        <div className="relative shrink-0">
          {scroll.hasMore ? (
            <div
              aria-hidden="true"
              className="from-sidebar pointer-events-none absolute inset-x-0 bottom-full z-10 h-8 bg-linear-to-t to-transparent group-data-[collapsible=icon]:hidden"
            />
          ) : null}
        </div>
        <SidebarFooter className="pt-1.75">
          <SidebarUserMenu name="Ada Lovelace" email="ada@usenotra.com">
            <DropdownMenuGroup>
              <DropdownMenuItem className={MENU_ITEM_CLASS_NAME}>
                <HugeiconsIcon icon={UserIcon} />
                My profile
                <KbdGroup className="ml-auto">
                  <Kbd>⌘</Kbd>
                  <Kbd>,</Kbd>
                </KbdGroup>
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS_NAME}>
                <HugeiconsIcon icon={Settings01Icon} />
                Appearance
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS_NAME}>
                <HugeiconsIcon icon={Message01Icon} />
                Feedback
                <Kbd className="ml-auto">F</Kbd>
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS_NAME}>
                <HugeiconsIcon icon={Calendar03Icon} />
                Schedule demo
                <Kbd className="ml-auto">S</Kbd>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={MENU_ITEM_CLASS_NAME}
              variant="destructive"
            >
              <HugeiconsIcon icon={Logout01Icon} />
              Log out
            </DropdownMenuItem>
          </SidebarUserMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <MobileTrigger />
          <h1 className="text-sm font-medium">
            {DEMO_PAGE_TITLES[activeHref] ?? "Overview"}
          </h1>
        </header>
        <div className="grid flex-1 auto-rows-min gap-4 p-4 sm:grid-cols-3">
          <div className="bg-muted/60 aspect-video rounded-xl" />
          <div className="bg-muted/60 aspect-video rounded-xl" />
          <div className="bg-muted/60 aspect-video rounded-xl" />
          <div className="bg-muted/60 h-64 rounded-xl sm:col-span-3" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
