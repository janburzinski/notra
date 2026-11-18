"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { useAutopilotSettingsSave } from "@/lib/hooks/use-autopilot-settings-save";
import type { AutopilotPausedProps } from "@/types/autopilot-onboarding";

/**
 * Autopilot set up once and then turned off: no new setup chat, just the
 * way back on with everything as it was saved.
 */
export function AutopilotPaused({
  organizationId,
  settings,
  canManage,
}: AutopilotPausedProps) {
  const { save } = useAutopilotSettingsSave(organizationId, settings);
  return (
    <>
      <PageHeading title="Autopilot" />
      <EmptyState
        action={
          canManage ? (
            <Button
              loading={save.isPending}
              onClick={() => save.mutate({ enabled: true })}
              size="sm"
            >
              Turn on Autopilot
            </Button>
          ) : null
        }
        description={
          canManage
            ? "It picks up where it left off, with the settings you saved."
            : "Ask a workspace admin to turn it back on."
        }
        title="Autopilot is paused"
      />
    </>
  );
}
