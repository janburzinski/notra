"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarGroup } from "@notra/ui/components/ui/sidebar";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  NAV_PRIMARY_ACTIONS,
  SIDEBAR_MODE_ENTER_CLASS,
  SIDEBAR_MODE_EXIT_RIGHT_CLASS,
  SIDEBAR_MODE_FADE_CLASS,
  SIDEBAR_MODE_SLOT_CLASS,
} from "@/constants/nav";
import type { NavModePrimaryActionProps } from "@/types/components/nav";
import dynamic from "@/utils/lazy-component";

const CreateContentDialog = dynamic(
  () =>
    import("@/components/content/create-content-dialog").then(
      (mod) => mod.CreateContentDialog
    ),
  { ssr: false }
);

const ACTION_CLASS = `col-start-1 row-start-1 w-full cursor-pointer group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0 ${SIDEBAR_MODE_FADE_CLASS}`;

export function NavModePrimaryAction({
  mode,
  organizationId,
}: NavModePrimaryActionProps) {
  const tLabels = useTranslations("common.labels");
  const [createOpen, setCreateOpen] = useState(false);
  const [createMounted, setCreateMounted] = useState(false);
  const studioActive = mode === "studio";
  const createAction = NAV_PRIMARY_ACTIONS.studio;
  const createLabel = tLabels("newPost");

  function openCreate() {
    setCreateMounted(true);
    setCreateOpen(true);
  }

  return (
    <>
      <div
        className={cn(
          SIDEBAR_MODE_SLOT_CLASS,
          studioActive
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <SidebarGroup className="py-1">
            <div className="grid overflow-hidden">
              <Button
                aria-hidden={!studioActive}
                className={cn(
                  ACTION_CLASS,
                  studioActive
                    ? SIDEBAR_MODE_ENTER_CLASS
                    : SIDEBAR_MODE_EXIT_RIGHT_CLASS
                )}
                inert={studioActive ? undefined : true}
                onClick={openCreate}
                size="sm"
                tabIndex={studioActive ? undefined : -1}
                title={createLabel}
              >
                <HugeiconsIcon icon={createAction.icon} />
                <span className="group-data-[collapsible=icon]:hidden">
                  {createLabel}
                </span>
              </Button>
            </div>
          </SidebarGroup>
        </div>
      </div>
      {createMounted && (
        <CreateContentDialog
          entry="nav_primary"
          hideTrigger
          onOpenChange={setCreateOpen}
          open={createOpen}
          organizationId={organizationId}
        />
      )}
    </>
  );
}
