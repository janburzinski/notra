"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ActionResultError } from "@/lib/actions/action-result-error";
import { authClient } from "@/lib/auth/client";
import { isTeamMemberLimitError } from "@/lib/billing/limits";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { cn } from "@/lib/utils";
import type {
  InviteMemberFormValues,
  InviteMemberPopoverProps,
  InviteRole,
} from "@/types/settings/members";

const INVITE_ROLES: readonly InviteRole[] = ["member", "admin"];
const DEFAULT_INVITE_VALUES: InviteMemberFormValues = {
  email: "",
  role: "member",
};

export function InviteMemberPopover({
  organizationId,
}: InviteMemberPopoverProps) {
  const t = useTranslations("members.invite");
  const tMembersShared = useTranslations("members.shared");
  const tMembers = useTranslations("members");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { openSettings } = useSettingsModal();

  const { mutate: inviteMember, isPending } = useMutation({
    mutationFn: async ({ email, role }: InviteMemberFormValues) => {
      const { error } = await authClient.organization.inviteMember({
        email: email.trim(),
        role,
        organizationId,
      });
      if (error) {
        throw new ActionResultError(error.message, error.code);
      }
    },
    onSuccess: () => {
      toast.success(t("sent"));
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({
        queryKey: ["invitations", organizationId],
      });
    },
    onError: (error) => {
      const message = error.message || t("sendFailed");
      if (
        error instanceof ActionResultError &&
        isTeamMemberLimitError(error.code)
      ) {
        toast.error(message, {
          action: {
            label: tMembers("viewPlans"),
            onClick: () => openSettings("billing"),
          },
        });
        return;
      }
      toast.error(message);
    },
  });

  const form = useForm({
    defaultValues: DEFAULT_INVITE_VALUES,
    onSubmit: ({ value }) => {
      if (value.email.trim().length === 0 || isPending) {
        return;
      }
      inviteMember(value);
    },
  });

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
        }
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button size="sm">
            <HugeiconsIcon className="size-4" icon={Add01Icon} />
            {tMembersShared("inviteMember")}
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="z-[60] w-80 gap-3 p-3"
        side="bottom"
      >
        <PopoverHeader>
          <PopoverTitle>{tMembersShared("inviteMember")}</PopoverTitle>
          <PopoverDescription>{t("description")}</PopoverDescription>
        </PopoverHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">{tCommon("labels.email")}</Label>
                <Input
                  autoComplete="email"
                  autoFocus
                  id="invite-email"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={t("emailPlaceholder")}
                  required
                  type="email"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="role">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">{tCommon("labels.role")}</Label>
                <div
                  aria-label={tCommon("labels.role")}
                  className="bg-muted grid grid-cols-2 rounded-lg p-[3px]"
                  id="invite-role"
                  role="radiogroup"
                >
                  {INVITE_ROLES.map((value) => {
                    const selected = field.state.value === value;
                    return (
                      <button
                        aria-checked={selected}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                          selected
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        key={value}
                        onClick={() => field.handleChange(value)}
                        role="radio"
                        type="button"
                      >
                        {tMembers("roleLabel", { role: value })}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </form.Field>
          <div className="flex justify-end gap-2 pt-0.5">
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              {tCommon("actions.cancel")}
            </Button>
            <form.Subscribe
              selector={(state) => state.values.email.trim().length > 0}
            >
              {(hasEmail) => (
                <Button
                  disabled={!hasEmail || isPending}
                  size="sm"
                  type="submit"
                >
                  {isPending
                    ? tCommon("labels.sending")
                    : tCommon("labels.send")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
