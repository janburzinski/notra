"use client";

import { Undo02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { AUTOPILOT_ONBOARDING_STORAGE_KEY } from "@/constants/autopilot-onboarding";
import { resetOnboardingSession } from "@/lib/hooks/use-autopilot-onboarding-session";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotRedoOnboardingRowProps } from "@/types/autopilot";
import { toErrorMessage } from "@/utils/error-message";

/**
 * Behind a feature flag: pauses Autopilot and brings Ollie's setup chat back
 * from the start, so the onboarding can be tried again on a real workspace.
 */
export function AutopilotRedoOnboardingRow({
  organizationId,
}: AutopilotRedoOnboardingRowProps) {
  const t = useTranslations("autopilot.settings.redoOnboarding");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const reset = useMutation({
    mutationFn: () =>
      dashboardOrpc.autopilot.resetOnboarding.call({ organizationId }),
    onSuccess: async () => {
      // Whatever this browser kept from an earlier chat starts over too.
      try {
        window.sessionStorage.removeItem(
          AUTOPILOT_ONBOARDING_STORAGE_KEY(organizationId)
        );
      } catch {
        // Nothing kept, nothing to clear.
      }
      resetOnboardingSession(organizationId);
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
      setOpen(false);
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Couldn't reset the onboarding")),
  });
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:flex sm:px-5">
      <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4.5"
          icon={Undo02Icon}
          strokeWidth={1.75}
        />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("description")}
        </p>
      </div>
      <div className="col-start-2 justify-self-start sm:shrink-0">
        <ConfirmDialog
          confirmLabel={t("confirm")}
          description={t("confirmDescription")}
          onConfirm={() => reset.mutateAsync().catch(() => undefined)}
          onOpenChange={setOpen}
          open={open}
          title={t("confirmTitle")}
          trigger={<Button variant="outline">{t("button")}</Button>}
        />
      </div>
      {/* Lines the button up with the summaries, which sit before a chevron. */}
      <span aria-hidden="true" className="hidden size-4 shrink-0 sm:block" />
    </div>
  );
}
