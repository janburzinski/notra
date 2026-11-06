"use client";

import {
  Cancel01Icon,
  MailSend01Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { authClient } from "@/lib/auth/client";
import { isTeamMemberLimitError } from "@/lib/billing/limits";
import { useRouter } from "@/lib/navigation";
import type {
  InvitationActionState,
  InvitationSummary,
} from "@/types/organizations/actions";

interface InvitationActionsProps {
  invitation: InvitationSummary;
}

export function InvitationActions({ invitation }: InvitationActionsProps) {
  const t = useTranslations("members.invitationActions");
  const tMembersShared = useTranslations("members.shared");
  const tMembers = useTranslations("members");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganizationsContext();
  const router = useRouter();

  const [action, setAction] = useState<InvitationActionState>(null);
  const isResending = action?.dialog === "resend" && action.pending;
  const isCanceling = action?.dialog === "cancel" && action.pending;

  if (!activeOrganization) {
    return null;
  }

  async function handleResendInvitation() {
    if (!activeOrganization) {
      return;
    }

    setAction({ dialog: "resend", pending: true });
    try {
      const { error } = await authClient.organization.resendInvitation({
        invitationId: invitation.id,
      });

      if (error) {
        const message = error.message || t("resendFailed");

        if (isTeamMemberLimitError(error.code)) {
          toast.error(message, {
            action: {
              label: tMembers("viewPlans"),
              onClick: () =>
                router.push(`/${activeOrganization.slug}/settings/billing`),
            },
          });
          setAction({ dialog: "resend", pending: false });
          return;
        }

        toast.error(message);
        setAction({ dialog: "resend", pending: false });
        return;
      }

      toast.success(t("resent", { email: invitation.email }));

      await queryClient.invalidateQueries({
        queryKey: ["invitations", activeOrganization.id],
      });

      setAction(null);
      return;
    } catch (error) {
      console.error("Error resending invitation:", error);
      toast.error(t("resendFailed"));
    }
    setAction({ dialog: "resend", pending: false });
  }

  async function handleCancelInvitation() {
    if (!activeOrganization) {
      return;
    }

    setAction({ dialog: "cancel", pending: true });
    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId: invitation.id,
      });

      if (error) {
        if (error.message) {
          toast.error(error.message);
        } else {
          toast.error(t("cancelFailed"));
        }
        setAction({ dialog: "cancel", pending: false });
        return;
      }

      toast.success(t("canceled", { email: invitation.email }));

      await queryClient.invalidateQueries({
        queryKey: ["invitations", activeOrganization.id],
      });

      setAction(null);
      return;
    } catch (error) {
      console.error("Error canceling invitation:", error);
      toast.error(t("cancelFailed"));
    }
    setAction({ dialog: "cancel", pending: false });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button className="size-8 p-0" variant="ghost">
              <span className="sr-only">{tCommon("labels.openMenu")}</span>
              <HugeiconsIcon className="size-4" icon={MoreVerticalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            disabled={isResending || isCanceling}
            onClick={() => setAction({ dialog: "resend", pending: false })}
          >
            <HugeiconsIcon className="mr-2 size-4" icon={MailSend01Icon} />
            {tMembersShared("resendInvitation")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isResending || isCanceling}
            onClick={() => setAction({ dialog: "cancel", pending: false })}
            variant="destructive"
          >
            <HugeiconsIcon className="mr-2 size-4" icon={Cancel01Icon} />
            {tMembersShared("cancelInvitation")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog
        onOpenChange={(open) => {
          if (!isResending) {
            setAction(open ? { dialog: "resend", pending: false } : null);
          }
        }}
        open={action?.dialog === "resend"}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("resendTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="wrap-anywhere">
              {t.rich("resendDescription", {
                email: invitation.email,
                strong: (chunks) => (
                  <span className="font-semibold underline">{chunks}</span>
                ),
              })}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose
              disabled={isResending}
              render={<Button variant="outline" />}
            >
              {tCommon("actions.cancel")}
            </ResponsiveDialogClose>
            <Button
              data-dialog-confirm
              disabled={isResending}
              onClick={handleResendInvitation}
            >
              {isResending
                ? t("resending")
                : tMembersShared("resendInvitation")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        confirmLabel={tMembersShared("cancelInvitation")}
        description={t("cancelDescription", { email: invitation.email })}
        onConfirm={handleCancelInvitation}
        onOpenChange={(open) =>
          setAction(open ? { dialog: "cancel", pending: false } : null)
        }
        open={action?.dialog === "cancel"}
        pending={isCanceling}
        title={t("cancelTitle")}
        variant="destructive"
      />
    </>
  );
}
