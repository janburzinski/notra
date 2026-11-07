import { SidebarProvider } from "@/registry/notra/sidebar/components/sidebar";

import { SidebarNav } from "../../../registry/notra/app-sidebar/components/sidebar-nav";
import { SidebarSearch } from "../../../registry/notra/app-sidebar/components/sidebar-search";
import { DEMO_NAV_GROUPS } from "../../../registry/notra/app-sidebar/constants/app-sidebar-demo";

export default function SidebarPreview() {
  return (
    <div className="bg-sidebar text-sidebar-foreground border-sidebar-border w-60 rounded-xl border p-2 shadow-xs">
      <SidebarProvider className="min-h-0" keyboardShortcut={null}>
        <div className="flex w-full flex-col gap-2">
          <SidebarSearch />
          <SidebarNav
            activeHref="#traffic"
            groups={DEMO_NAV_GROUPS.slice(0, 6)}
          />
        </div>
      </SidebarProvider>
    </div>
  );
}
