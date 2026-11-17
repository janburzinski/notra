"use client";

import { Globe02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Checkbox } from "@notra/ui/components/ui/checkbox";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ChatShareAccess, ChatShareSummary } from "@/types/chat-share";
import { chatShareUrl } from "@/utils/chat-share";
import { toastCopyError, writeClipboardText } from "@/utils/copy-to-clipboard";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Creating, deleting and switching live updates for a chat's public link. */
function useChatShareActions(
  input: { organizationId: string; chatId: string },
  origin: string
) {
  const t = useTranslations("chat.share");
  const queryClient = useQueryClient();
  const { queryKey } = dashboardOrpc.chat.shares.get.queryOptions({ input });
  const setShare = (next: ChatShareSummary | null) =>
    queryClient.setQueryData(queryKey, { share: next });

  const publish = useMutation({
    mutationFn: () => dashboardOrpc.chat.shares.publish.call(input),
    onSuccess: async ({ share: next }) => {
      setShare(next);
      try {
        await writeClipboardText(chatShareUrl(origin, next.shareId));
        toast.success(t("createdAndCopied"));
      } catch {
        toast.success(t("created"));
      }
    },
    onError: (error) => toast.error(errorMessage(error, t("publishFailed"))),
  });

  const autoUpdate = useMutation({
    mutationFn: (next: boolean) =>
      dashboardOrpc.chat.shares.setAutoUpdate.call({
        ...input,
        autoUpdate: next,
      }),
    onSuccess: ({ share: next }) => setShare(next),
    onError: (error) => toast.error(errorMessage(error, t("autoUpdateFailed"))),
  });

  const revoke = useMutation({
    mutationFn: () => dashboardOrpc.chat.shares.revoke.call(input),
    onSuccess: () => {
      setShare(null);
      toast.success(t("revoked"));
    },
    onError: (error) => toast.error(errorMessage(error, t("revokeFailed"))),
  });

  const busy = publish.isPending || revoke.isPending || autoUpdate.isPending;

  return {
    busy,
    deleting: revoke.isPending,
    /** The pending choice while it saves, so the checkbox doesn't flicker. */
    isAutoUpdating: (saved: boolean) =>
      (autoUpdate.isPending ? autoUpdate.variables : undefined) ?? saved,
    setAutoUpdate: (next: boolean) => autoUpdate.mutate(next),
    deleteLink: () => revoke.mutate(),
    changeAccess: (next: ChatShareAccess) => {
      if (busy) {
        return;
      }
      if (next === "public") {
        publish.mutate();
      } else {
        revoke.mutate();
      }
    },
  };
}

/** Off shows when the stored snapshot was taken; on serves the live chat. */
function ChatShareLiveToggle({
  checked,
  disabled,
  onCheckedChange,
  snapshotAt,
}: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (next: boolean) => void;
  snapshotAt: string;
}) {
  const t = useTranslations("chat.share");
  const format = useFormatter();
  const snapshotInfo = t("snapshotInfo", {
    date: format.dateTime(new Date(snapshotAt), {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  });
  return (
    <div className="flex flex-col gap-0.5">
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control */}
      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => onCheckedChange(next === true)}
        />
        {t("autoUpdate")}
      </label>
      <p className="text-muted-foreground ps-6 text-xs">
        {checked ? t("autoUpdateOn") : snapshotInfo}
      </p>
    </div>
  );
}

function ChatShareDeleteRow({
  disabled,
  loading,
  onDelete,
}: {
  disabled: boolean;
  loading: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations("chat.share");
  return (
    <div className="-mx-2.5 mt-1.5 -mb-2.5 flex items-center justify-end border-t px-4 py-3">
      <Button
        disabled={disabled}
        loading={loading}
        onClick={onDelete}
        size="xs"
        variant="destructive"
      >
        {t("delete")}
      </Button>
    </div>
  );
}

export function ChatSharePopover({ chatId }: { chatId: string }) {
  const t = useTranslations("chat.share");
  const { activeOrganization } = useOrganizationsContext();
  const [open, setOpen] = useState(false);
  const organizationId = activeOrganization?.id ?? "";
  const input = { organizationId, chatId };
  const queryOptions = dashboardOrpc.chat.shares.get.queryOptions({ input });
  const { data, isPending } = useQuery({
    ...queryOptions,
    enabled: open && Boolean(organizationId),
  });
  const share = data?.share ?? null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const teamUrl = `${origin}/${activeOrganization?.slug ?? ""}/chat/${chatId}`;
  const publicUrl = share ? chatShareUrl(origin, share.shareId) : "";

  const actions = useChatShareActions(input, origin);
  const { busy } = actions;
  const isAutoUpdating = actions.isAutoUpdating(Boolean(share?.autoUpdate));
  const access: ChatShareAccess = share ? "public" : "team";
  // Until we know whether a public link exists, show nothing to copy rather
  // than the team link.
  let url = "";
  if (!isPending) {
    url = share ? publicUrl : teamUrl;
  }
  const accessOptions = [
    {
      value: "team",
      label: t("access.team", { organization: activeOrganization?.name ?? "" }),
    },
    { value: "public", label: t("access.public") },
  ] satisfies { value: ChatShareAccess; label: string }[];

  const changeAccess = (next: ChatShareAccess) => {
    if (next !== access) {
      actions.changeAccess(next);
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="active:scale-100"
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <HugeiconsIcon
          className="size-4"
          icon={Globe02Icon}
          strokeWidth={1.8}
        />
        {t("button")}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-88"
        initialFocus={false}
        sideOffset={6}
      >
        <div className="flex flex-col gap-2.5 p-1.5">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{t("title")}</p>
            <Select
              disabled={busy || isPending}
              items={accessOptions}
              onValueChange={(next) => changeAccess(next as ChatShareAccess)}
              value={access}
            >
              <SelectTrigger
                aria-label={t("accessLabel")}
                className="-ml-2.5 max-w-full"
                variant="ghost"
              >
                <HugeiconsIcon
                  className="text-muted-foreground size-4 shrink-0"
                  icon={access === "public" ? Globe02Icon : UserGroupIcon}
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="w-auto">
                {accessOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <InputGroup>
            <InputGroupInput
              aria-label={t("linkLabel")}
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={url}
            />
            <InputGroupAddon align="inline-end">
              <CopyButton
                disabled={!url}
                copiedLabel={t("copied")}
                onCopyError={toastCopyError}
                size="xs"
                value={url}
                variant="ghost"
              >
                {t("copy")}
              </CopyButton>
            </InputGroupAddon>
          </InputGroup>
          {share ? (
            <ChatShareLiveToggle
              checked={isAutoUpdating}
              disabled={busy}
              onCheckedChange={actions.setAutoUpdate}
              snapshotAt={share.updatedAt}
            />
          ) : null}
        </div>
        {share ? (
          <ChatShareDeleteRow
            disabled={busy}
            loading={actions.deleting}
            onDelete={actions.deleteLink}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
