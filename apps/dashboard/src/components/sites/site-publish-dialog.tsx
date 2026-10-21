"use client";

import { GitCommitIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SitePublishChange } from "@/components/sites/editor/site-publish-change";
import { SITE_PUBLISH_MESSAGE_MAX_LENGTH } from "@/constants/site-publish";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishDialogProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";
import { siteDraftVersion } from "@/utils/site-draft-version";
import { publishConflictPaths, siteDraftChange } from "@/utils/site-editor";
import { siteValidationReady } from "@/utils/site-validation-ready";

export function SitePublishDialog({
  organizationId,
  siteId,
  open,
  onOpenChange,
  draftCount,
  drafts,
  sourcePaths,
  onPublished,
  onConflict,
  unsaved = false,
  initialMessage = "",
}: SitePublishDialogProps) {
  const t = useTranslations("sites.publish");
  const tCommon = useTranslations("common");
  const tChanges = useTranslations("sites.editorPage.publishDialog");
  const id = useId();
  const [message, setMessage] = useState(initialMessage);
  const trimmed = message.trim();
  const client = useQueryClient();
  const draftVersion = siteDraftVersion(drafts);
  const validationOptions = dashboardOrpc.sites.editor.validate.queryOptions({
    input: { organizationId, siteId },
    enabled: open,
    staleTime: 0,
  });
  const validation = useQuery({
    ...validationOptions,
    queryKey: [...validationOptions.queryKey, draftVersion],
  });
  const statusOptions = dashboardOrpc.sites.branches.status.queryOptions({
    input: { organizationId, siteId },
    enabled: open,
    staleTime: 0,
  });
  const status = useQuery({
    ...statusOptions,
    queryKey: [...statusOptions.queryKey, draftVersion],
  });
  const canPublish =
    trimmed.length > 0 &&
    draftCount > 0 &&
    !unsaved &&
    siteValidationReady(validation) &&
    status.isSuccess &&
    !status.isPlaceholderData &&
    status.data.canPublishDirect;

  const publishMutation = useMutation({
    mutationFn: () =>
      dashboardOrpc.sites.editor.publish.call({
        organizationId,
        siteId,
        message: trimmed,
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: dashboardOrpc.sites.key() });
      setMessage("");
      onOpenChange(false);
      onPublished();
      toast.success(result.deployPending ? t("deployPending") : t("committed"));
    },
    onError: (error) => {
      const paths = publishConflictPaths(error);
      if (paths && paths.length > 0) {
        onOpenChange(false);
        onConflict(paths);
        return;
      }
      toast.error(toErrorMessage(error, t("failed")));
    },
  });

  return (
    <ResponsiveDialog
      onOpenChange={(next) => {
        if (!publishMutation.isPending) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:max-w-2xl">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description", { count: draftCount })}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="min-h-0 min-w-0 space-y-4 overflow-y-auto"
          id={`${id}-form`}
          action={() => {
            if (canPublish && !publishMutation.isPending) {
              publishMutation.mutate();
            }
          }}
        >
          {drafts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{tChanges("changes")}</p>
              <div className="divide-border max-h-[45dvh] divide-y overflow-y-auto overscroll-contain rounded-lg border">
                {drafts.map((draft, index) => (
                  <SitePublishChange
                    change={siteDraftChange(draft, sourcePaths)}
                    defaultOpen={index === 0}
                    key={draft.path}
                    organizationId={organizationId}
                    path={draft.path}
                    siteId={siteId}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`${id}-message`}>{t("message")}</Label>
            <Input
              autoComplete="off"
              id={`${id}-message`}
              maxLength={SITE_PUBLISH_MESSAGE_MAX_LENGTH}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("messagePlaceholder")}
              value={message}
            />
          </div>
        </form>
        <ResponsiveDialogFooter className="shrink-0">
          <Button
            disabled={publishMutation.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button
            disabled={!canPublish}
            form={`${id}-form`}
            loading={publishMutation.isPending}
            type="submit"
            data-dialog-confirm
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={GitCommitIcon}
              strokeWidth={1.5}
            />
            {t("commit")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
