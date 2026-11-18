"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";

import { Button } from "@/components/button";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";

/** Shown while scheduled runs are skipped because nothing is left to spend. */
export function AutopilotOutOfCreditsNotice() {
  const { openSettings } = useSettingsModal();
  return (
    <Alert variant="warning">
      <HugeiconsIcon aria-hidden="true" icon={Alert02Icon} strokeWidth={1.5} />
      <AlertTitle>Autopilot is paused</AlertTitle>
      <AlertDescription>
        <div>
          This workspace has no pull request or AI credits left, so daily runs
          are skipped. They start again by themselves when credits reset or you
          top up.
        </div>
        <Button
          className="mt-3"
          onClick={() => openSettings("credits")}
          size="sm"
        >
          Add credits
        </Button>
      </AlertDescription>
    </Alert>
  );
}
