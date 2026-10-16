"use client";

import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@notra/ui/components/ui/alert-dialog";
import { Button } from "@notra/ui/components/ui/button";
import { Label } from "@notra/ui/components/ui/label";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useState } from "react";

import { SITE_MAX_SUSPENSION_REASON_LENGTH } from "@/constants/sites";
import { useSiteActions } from "@/hooks/use-site-actions";
import type { SiteSuspendDialogProps } from "@/types/sites";

export function SiteSuspendDialog({
  siteId,
  siteName,
  suspended,
}: SiteSuspendDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  // Fixed when the dialog opens, so the refetch after the mutation can't swap
  // its copy while it closes.
  const [reactivating, setReactivating] = useState(suspended);
  const { setSuspended } = useSiteActions();

  function onOpenChange(next: boolean) {
    if (next) {
      setReactivating(suspended);
    }
    setOpen(next);
  }

  function confirm() {
    setSuspended.mutate(
      {
        siteId,
        suspended: !reactivating,
        reason: reactivating ? undefined : reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setReason("");
        },
      }
    );
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogTrigger
        render={<Button size="sm" variant={suspended ? "outline" : "ghost"} />}
      >
        <HugeiconsIcon icon={suspended ? PlayIcon : PauseIcon} />
        {suspended ? "Reactivate" : "Suspend"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {reactivating ? `Reactivate ${siteName}?` : `Suspend ${siteName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reactivating
              ? "The site is served again right away, from its current production deployment."
              : "Every domain of this site stops serving right away. Visitors see an offline page until the site is reactivated."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {reactivating ? null : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-suspend-reason">Reason (optional)</Label>
            <Textarea
              id="site-suspend-reason"
              maxLength={SITE_MAX_SUSPENSION_REASON_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Abuse report, unpaid invoice, …"
              value={reason}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={setSuspended.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={setSuspended.isPending}
            onClick={confirm}
            variant={reactivating ? "default" : "destructive"}
          >
            {reactivating ? "Reactivate" : "Suspend site"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
