"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SITE_BRANCH_DIALOG_TITLES } from "@/constants/site-branches";
import type { SiteBranchDialogProps } from "@/types/site-branches";

export function SiteBranchDialog({
  action,
  draftCount,
  loading,
  onClose,
  onConfirm,
}: SiteBranchDialogProps) {
  const t = useTranslations("sites.branches");
  const common = useTranslations("common");
  const id = useId();
  const [title, setTitle] = useState("");
  const [bring, setBring] = useState(true);
  const kind = action?.kind ?? "create";
  return (
    <ResponsiveDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !loading) {
          onClose();
        }
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t(SITE_BRANCH_DIALOG_TITLES[kind])}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {kind === "delete" || kind === "discardDeleted"
              ? t(
                  kind === "delete"
                    ? "deleteDescription"
                    : "discardDeletedDescription",
                  { branch: action?.branch ?? "" }
                )
              : t("nameHint")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          id={id}
          action={() => onConfirm(title, bring)}
          className="space-y-4"
        >
          {kind !== "delete" && kind !== "discardDeleted" ? (
            <div className="space-y-2">
              <Label htmlFor={`${id}-title`}>{t("title")}</Label>
              <Input
                id={`${id}-title`}
                autoComplete="off"
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required={kind === "rename"}
              />
            </div>
          ) : null}
          {kind === "create" && draftCount > 0 ? (
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-2">
                {t("pending", { count: draftCount })}
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-bring`}
                  checked={bring}
                  onChange={() => setBring(true)}
                />
                {t("bring")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-bring`}
                  checked={!bring}
                  onChange={() => setBring(false)}
                />
                {t("leave")}
              </label>
              <p className="text-muted-foreground text-xs">
                {t("originalKeepsChanges")}
              </p>
            </fieldset>
          ) : null}
        </form>
        <ResponsiveDialogFooter>
          <Button variant="outline" disabled={loading} onClick={onClose}>
            {common("actions.cancel")}
          </Button>
          <Button
            variant={
              kind === "delete" || kind === "discardDeleted"
                ? "destructive"
                : "default"
            }
            loading={loading}
            type="submit"
            form={id}
          >
            {t(kind)}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
