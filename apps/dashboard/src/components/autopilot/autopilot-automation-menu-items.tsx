"use client";

import {
  Cancel01Icon,
  Delete02Icon,
  PauseIcon,
  PlayCircleIcon,
  PlayIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@notra/ui/components/ui/context-menu";

import type { AutopilotAutomationMenuItemsProps } from "@/types/autopilot-metrics";

/** What right-clicking a row of the Autopilot automations table offers. */
export function AutopilotAutomationMenuItems({
  row,
  canManage,
  runDisabled,
  toggleBusy,
  onOpen,
  onRun,
  onTurnOff,
  onSetWorkflowEnabled,
  onDeleteWorkflow,
}: AutopilotAutomationMenuItemsProps) {
  return (
    <>
      <ContextMenuItem onClick={() => onOpen(row)}>
        <HugeiconsIcon icon={ViewIcon} />
        Open
      </ContextMenuItem>
      {canManage ? (
        <>
          <ContextMenuItem disabled={runDisabled} onClick={() => onRun(row)}>
            <HugeiconsIcon icon={PlayIcon} />
            Run now
          </ContextMenuItem>
          {row.type === "workflow" && row.workflow.schedule ? (
            <ContextMenuItem
              disabled={toggleBusy}
              onClick={() =>
                onSetWorkflowEnabled(row.id, !row.workflow.enabled)
              }
            >
              <HugeiconsIcon
                icon={row.workflow.enabled ? PauseIcon : PlayCircleIcon}
              />
              {row.workflow.enabled ? "Pause schedule" : "Resume schedule"}
            </ContextMenuItem>
          ) : null}
          <ContextMenuSeparator />
          {row.type === "builtin" ? (
            <ContextMenuItem
              disabled={toggleBusy}
              onClick={() => onTurnOff(row.kind)}
            >
              <HugeiconsIcon icon={Cancel01Icon} />
              Turn off
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onClick={() => onDeleteWorkflow(row.workflow)}
              variant="destructive"
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Delete…
            </ContextMenuItem>
          )}
        </>
      ) : null}
    </>
  );
}
