"use client";

import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@notra/ui/components/shared/responsive-alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import { Button } from "@notra/ui/components/ui/button";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
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
import { Switch } from "@notra/ui/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BuildingIcon,
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  InfoIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockIcon,
  Share2Icon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatVisibility } from "@/schemas/chat-share";

interface ShareState {
  visibility: ChatVisibility;
  shareUrl: string | null;
  hasPassword: boolean;
  allowFork: boolean;
  expiresAt: string | null;
  invitees: { email: string; userId: string | null }[];
}

interface ShareChatPopoverProps {
  organizationId: string;
  chatId: string;
  owner: {
    name: string;
    email: string;
    image: string | null;
  };
}

const EXPIRY_PRESETS = [
  { label: "Never", value: "never", ms: null },
  { label: "1 hour", value: "1h", ms: 60 * 60 * 1000 },
  { label: "24 hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", value: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
] as const satisfies readonly {
  label: string;
  value: string;
  ms: number | null;
}[];

type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["value"] | "custom";

interface VisibilityOption {
  value: ChatVisibility;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VISIBILITY_OPTIONS = [
  {
    value: "private",
    label: "Private",
    description: "Only invited people can view",
    icon: LockIcon,
  },
  {
    value: "link",
    label: "Anyone with the link",
    description: "Public unlisted link",
    icon: GlobeIcon,
  },
  {
    value: "password",
    label: "Password protected",
    description: "Anyone with link + password",
    icon: KeyRoundIcon,
  },
  {
    value: "organization",
    label: "Organization",
    description: "Anyone in your org can view",
    icon: BuildingIcon,
  },
] as const satisfies readonly VisibilityOption[];

const VISIBILITY_META_BY_VALUE = new Map(
  VISIBILITY_OPTIONS.map((option) => [option.value, option])
);

function getVisibilityMeta(visibility: ChatVisibility): VisibilityOption {
  const meta = VISIBILITY_META_BY_VALUE.get(visibility);
  if (!meta) {
    throw new Error(`Unknown chat visibility: ${visibility}`);
  }
  return meta;
}

export function ShareChatPopover({
  organizationId,
  chatId,
  owner,
}: ShareChatPopoverProps) {
  const queryClient = useQueryClient();
  const queryKey = ["chat-share", organizationId, chatId] as const;

  const { data, isLoading } = useQuery<{ share: ShareState }>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/${chatId}/share`
      );
      if (!response.ok) {
        throw new Error("Failed to load share settings");
      }
      return response.json();
    },
  });

  const share = data?.share;

  const [visibility, setVisibility] = useState<ChatVisibility>("private");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [password, setPassword] = useState("");
  const [allowFork, setAllowFork] = useState(false);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("never");
  const [copied, setCopied] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  useEffect(() => {
    if (!share) {
      return;
    }
    setVisibility(share.visibility);
    setInviteEmails(share.invitees.map((invitee) => invitee.email));
    setAllowFork(share.allowFork);
    setExpiryPreset(share.expiresAt ? "custom" : "never");
  }, [share]);

  const mutation = useMutation({
    mutationFn: async (variables: {
      body: Record<string, unknown>;
      successMessage?: string;
    }): Promise<{ result: { share: ShareState }; successMessage?: string }> => {
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/${chatId}/share`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(variables.body),
        }
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? "Failed to update share");
      }
      return {
        result: await response.json(),
        successMessage: variables.successMessage,
      };
    },
    onSuccess: ({ result, successMessage }) => {
      queryClient.setQueryData(queryKey, result);
      queryClient.invalidateQueries({
        queryKey: ["chat-sessions", organizationId],
      });
      if (successMessage) {
        toast.success(successMessage);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<{ share: ShareState }> => {
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/${chatId}/share`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("Failed to remove share");
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      toast.success("Sharing disabled");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submitUpdate(
    overrides: Record<string, unknown>,
    successMessage?: string
  ) {
    const targetVisibility =
      (overrides.visibility as ChatVisibility | undefined) ?? visibility;
    mutation.mutate({
      body: {
        visibility: targetVisibility,
        inviteEmails: targetVisibility === "private" ? inviteEmails : undefined,
        allowFork,
        ...overrides,
      },
      successMessage,
    });
  }

  function onAddInvitee() {
    const candidate = emailDraft.trim().toLowerCase();
    if (!candidate || !candidate.includes("@")) {
      return;
    }
    if (inviteEmails.includes(candidate)) {
      setEmailDraft("");
      return;
    }
    const next = [...inviteEmails, candidate];
    setInviteEmails(next);
    setEmailDraft("");
    submitUpdate(
      { visibility: "private", inviteEmails: next },
      `Added ${candidate}`
    );
  }

  function onRemoveInvitee(email: string) {
    const next = inviteEmails.filter((entry) => entry !== email);
    setInviteEmails(next);
    submitUpdate(
      { visibility: "private", inviteEmails: next },
      `Removed ${email}`
    );
  }

  function onVisibilityChange(next: ChatVisibility) {
    setVisibility(next);
    if (next === "password") {
      return;
    }
    submitUpdate(
      { visibility: next },
      `Visibility set to ${getVisibilityMeta(next).label}`
    );
  }

  function onSavePassword() {
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    submitUpdate(
      { visibility: "password", password },
      share?.hasPassword ? "Password updated" : "Password set"
    );
    setPassword("");
  }

  function onAllowForkChange(next: boolean) {
    setAllowFork(next);
    submitUpdate(
      { allowFork: next },
      next ? "Forking enabled" : "Forking disabled"
    );
  }

  function onExpiryChange(next: ExpiryPreset) {
    setExpiryPreset(next);
    const preset = EXPIRY_PRESETS.find((entry) => entry.value === next);
    const expiresAt =
      preset && preset.ms !== null
        ? new Date(Date.now() + preset.ms).toISOString()
        : null;
    submitUpdate(
      { expiresAt },
      next === "never"
        ? "Expiry removed"
        : `Expires in ${preset?.label ?? next}`
    );
  }

  async function onCopyLink() {
    if (!share?.shareUrl) {
      return;
    }
    await navigator.clipboard.writeText(share.shareUrl);
    setCopied(true);
    toast.success("Link copied");
    window.setTimeout(() => setCopied(false), 1500);
  }

  function onDisableSharing() {
    deleteMutation.mutate(undefined, {
      onSettled: () => setDisableDialogOpen(false),
    });
  }

  const visibilityMeta = getVisibilityMeta(visibility);
  const VisibilityIcon = visibilityMeta.icon;
  const canCopy = Boolean(share?.shareUrl);
  const isSaving = mutation.isPending || deleteMutation.isPending;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline">
            <Share2Icon className="size-4" />
            Share
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-medium text-sm">Share</p>
          {isSaving && (
            <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col gap-4 px-4 py-3">
          <section className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">People with access</p>
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                {owner.image && <AvatarImage src={owner.image} />}
                <AvatarFallback>
                  {owner.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate font-medium text-sm">
                  {owner.name} (you)
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {owner.email}
                </p>
              </div>
              <span className="rounded-md border px-2 py-1 text-muted-foreground text-xs">
                Owner
              </span>
            </div>

            {visibility === "private" && (
              <>
                {inviteEmails.map((email) => (
                  <div
                    className="flex items-center gap-3 rounded-md border px-2 py-1.5"
                    key={email}
                  >
                    <Avatar className="size-7">
                      <AvatarFallback>
                        {email.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="flex-1 truncate text-sm">{email}</p>
                    <Button
                      onClick={() => onRemoveInvitee(email)}
                      size="icon"
                      variant="ghost"
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    onChange={(event) => setEmailDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onAddInvitee();
                      }
                    }}
                    placeholder="Add by email"
                    type="email"
                    value={emailDraft}
                  />
                  <Button onClick={onAddInvitee} size="sm" variant="outline">
                    Add
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <Label htmlFor="share-visibility">Visibility</Label>
            <Select
              onValueChange={(value) =>
                value && onVisibilityChange(value as ChatVisibility)
              }
              value={visibility}
            >
              <SelectTrigger className="w-full" id="share-visibility">
                <SelectValue>
                  <VisibilityIcon className="size-4" />
                  <span>{visibilityMeta.label}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <Icon className="size-4" />
                      <span className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {option.description}
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {visibility === "password" && (
              <div className="flex flex-col gap-2 pt-1">
                <Input
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    share?.hasPassword
                      ? "Enter a new password to rotate"
                      : "Set a password"
                  }
                  type="password"
                  value={password}
                />
                <Button
                  disabled={password.length < 4}
                  onClick={onSavePassword}
                  size="sm"
                >
                  {share?.hasPassword ? "Update password" : "Set password"}
                </Button>
                {share?.hasPassword && (
                  <p className="text-muted-foreground text-xs">
                    A password is currently set.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="share-fork">Allow forking</Label>
                <p className="text-muted-foreground text-xs">
                  Viewers can continue this chat in their own workspace.
                </p>
              </div>
              <Switch
                checked={allowFork}
                id="share-fork"
                onCheckedChange={onAllowForkChange}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="share-expiry">Link expires</Label>
              <Select
                disabled={visibility === "private"}
                onValueChange={(value) =>
                  value && onExpiryChange(value as ExpiryPreset)
                }
                value={expiryPreset}
              >
                <SelectTrigger className="w-full" id="share-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  {expiryPreset === "custom" && (
                    <SelectItem value="custom">Custom</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {share?.expiresAt && (
                <p className="text-muted-foreground text-xs">
                  Expires {new Date(share.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          {share && share.visibility !== "private" ? (
            <Button
              className="h-auto gap-1.5 px-0 text-muted-foreground text-xs hover:bg-transparent hover:text-destructive"
              onClick={() => setDisableDialogOpen(true)}
              size="sm"
              variant="ghost"
            >
              <TrashIcon className="size-3.5" />
              Disable sharing
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <InfoIcon className="size-3.5" />
              {isLoading ? "Loading..." : "How does sharing work?"}
            </span>
          )}
          <Button
            disabled={!canCopy}
            onClick={onCopyLink}
            size="sm"
            variant="outline"
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
            Copy Link
          </Button>
        </div>
      </PopoverContent>

      <ResponsiveAlertDialog
        onOpenChange={(open) => {
          if (!deleteMutation.isPending) {
            setDisableDialogOpen(open);
          }
        }}
        open={disableDialogOpen}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              Disable sharing?
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              Any existing share link will stop working.
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={onDisableSharing}
            >
              {deleteMutation.isPending ? "Disabling..." : "Disable"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </Popover>
  );
}
