"use client";

import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";

import { Button } from "@/components/button";
import type { IrisPauseDialogProps } from "@/types/iris";

export function IrisPauseDialog({
  open,
  isPausing,
  onOpenChange,
  onConfirm,
}: IrisPauseDialogProps) {
  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Pause Iris?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Pausing stops scheduled runs and cancels pending Slack messages. You
            can resume at any time.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button
            disabled={isPausing}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Keep running
          </Button>
          <Button disabled={isPausing} onClick={onConfirm}>
            {isPausing ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
                Pausing
              </>
            ) : (
              "Pause Iris"
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
