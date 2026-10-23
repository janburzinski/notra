"use client";

import {
  Alert02Icon,
  Delete02Icon,
  InformationCircleIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@notra/ui/components/shared/responsive-dialog";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { SITE_DESIGN_SECTIONS } from "@/constants/site-design-sections";
import { cn } from "@/lib/utils";
import type {
  SiteChangesStripProps,
  SiteChangesStripStateProps,
} from "@/types/components/sites";
import type { SiteWorkspaceValue } from "@/types/site-workspace";
import { siteBranchLabel } from "@/utils/site-branch-label";
import { configSectionChanged } from "@/utils/site-design-sections";

const TONES = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
} as const;

function Strip({ tone, title, description, children }: SiteChangesStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-4 py-2.5 lg:px-5",
        TONES[tone]
      )}
      role={tone === "info" ? "status" : "alert"}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 self-start"
        icon={tone === "info" ? InformationCircleIcon : Alert02Icon}
        strokeWidth={2}
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{title}</p>
        <p className="opacity-90">{description}</p>
      </div>
      {children ? (
        <div className="flex w-full shrink-0 items-center justify-end gap-2 pl-7 sm:w-auto sm:pl-0">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Unpublished edits, save failures and conflicts, shown once under the site header. */
export function SiteChangesBanner() {
  const state = useSiteWorkspace();
  if (!state || state.malformed) {
    return null;
  }
  return <SiteChangesStrip state={state} />;
}

function SiteChangesStrip({ state }: SiteChangesStripStateProps) {
  const t = useTranslations("sites.design.workspace");
  const banner = useTranslations("sites.design.workspace.banner");
  const unpublished = useUnpublishedSummary(state);
  const common = useTranslations("common");
  const branches = useTranslations("sites.branches");
  const { discardOpen, setDiscardOpen } = state;
  const [discardError, setDiscardError] = useState(false);
  const busy =
    state.readOnly ||
    state.uploading ||
    state.saves.state.status === "saving" ||
    state.controller.props.commitStatus === "pending";
  const discard = (
    <ResponsiveDialog
      open={discardOpen}
      onOpenChange={(open) => {
        if (!state.readOnly) {
          setDiscardOpen(open);
          setDiscardError(false);
        }
      }}
    >
      <ResponsiveDialogTrigger
        render={<Button disabled={busy} size="sm" variant="secondary" />}
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={Delete02Icon}
          strokeWidth={2}
        />
        {branches("discard")}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {banner("discardTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {banner("discardDescription")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {discardError ? <p role="alert">{banner("discardFailed")}</p> : null}
        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            disabled={state.readOnly}
            onClick={() => setDiscardOpen(false)}
          >
            {common("actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            loading={state.readOnly}
            disabled={busy}
            onClick={async () => {
              setDiscardError(false);
              try {
                await state.discardChanges();
                setDiscardOpen(false);
              } catch {
                setDiscardError(true);
              }
            }}
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Delete02Icon}
              strokeWidth={2}
            />
            {banner("discardAction")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
  if (state.conflicts.length > 0) {
    return (
      <Strip
        description={banner("conflict")}
        title={banner("conflictTitle")}
        tone="destructive"
      >
        <Button
          disabled={busy}
          size="sm"
          variant="ghost"
          onClick={() => {
            void state.resolveConflict(false);
          }}
        >
          {t("discardChanges")}
        </Button>
        <Button
          disabled={busy || state.invalid}
          size="sm"
          variant="outline"
          onClick={() => {
            void state.resolveConflict(true);
          }}
        >
          {t("keepChanges")}
        </Button>
      </Strip>
    );
  }
  if (state.saves.state.status === "error") {
    return (
      <Strip
        description={banner("saveFailed")}
        title={banner("saveFailedTitle")}
        tone="destructive"
      >
        <Button
          size="sm"
          variant="outline"
          onClick={state.controller.retrySave}
        >
          {banner("retry")}
        </Button>
        {discard}
      </Strip>
    );
  }
  if (state.invalid) {
    return (
      <Strip
        description={banner("invalid")}
        title={banner("invalidTitle")}
        tone="warning"
      >
        {discard}
      </Strip>
    );
  }
  return unpublished ? (
    <Strip tone="info" {...unpublished}>
      {state.files.drafts.length > 0 || state.unsaved ? discard : null}
      <Button
        disabled={busy || state.invalid || state.unsaved}
        size="sm"
        onClick={() => state.setPublishOpen(true)}
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={Rocket01Icon}
          strokeWidth={2}
        />
        {branches("publish")}
      </Button>
    </Strip>
  ) : null;
}

function useUnpublishedSummary(state: SiteWorkspaceValue) {
  const { detail } = useSite();
  const banner = useTranslations("sites.design.workspace.banner");
  const titles = useTranslations("sites.design.sections.titles");
  const branches = useTranslations("sites.branches");
  const locale = useLocale();
  const listFormat = useMemo(
    () => new Intl.ListFormat(locale, { type: "conjunction" }),
    [locale]
  );
  const sections = SITE_DESIGN_SECTIONS.filter((section) =>
    configSectionChanged(state.config, state.published, section.paths)
  ).map((section) => titles(section.id));
  // Variables and other keys outside the Design sections still differ from
  // production after a feature branch commits them and its drafts clear.
  const configChanged = configSectionChanged(state.config, state.published, [
    ...new Set([...Object.keys(state.config), ...Object.keys(state.published)]),
  ]);
  const otherDrafts = state.files.drafts.some(
    (draft) => draft.path !== SITE_CONFIG_FILENAME
  );
  if (!configChanged && state.files.drafts.length === 0) {
    return null;
  }
  const branch = state.scope.branch;
  const feature = Boolean(branch && branch !== detail.site.productionBranch);
  const branchName = siteBranchLabel(branch ?? "", locale, (date) =>
    branches("draftFrom", { date })
  );
  if (sections.length > 0 && !otherDrafts) {
    const list = listFormat.format(sections);
    return {
      title: banner("unpublishedTitle", { count: sections.length }),
      description: feature
        ? banner("unpublishedBranch", { sections: list, branch: branchName })
        : banner("unpublished", { sections: list }),
    };
  }
  return {
    title: banner("unpublishedFilesTitle", {
      count: Math.max(state.files.drafts.length, 1),
    }),
    description: feature
      ? banner("unpublishedBranchFiles", { branch: branchName })
      : banner("unpublishedFiles"),
  };
}
