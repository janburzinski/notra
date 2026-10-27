"use client";

import { Alert02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import {
  useSiteWorkspace,
  useSiteWorkspaceLoad,
} from "@/components/sites/site-workspace-context";
import { SITE_DESIGN_SECTIONS } from "@/constants/site-design-sections";
import { SITE_CHANGES_STRIP_TONES } from "@/constants/sites";
import { useSiteNavSection } from "@/lib/hooks/use-site-nav-section";
import { cn } from "@/lib/utils";
import type {
  SiteChangesStripProps,
  SiteChangesStripStateProps,
  SiteDiscardChangesButtonProps,
} from "@/types/components/sites";
import type { SiteWorkspaceValue } from "@/types/site-workspace";
import { siteBranchLabel } from "@/utils/site-branch-label";
import { configSectionChanged } from "@/utils/site-design-sections";

function Strip({ tone, title, description, children }: SiteChangesStripProps) {
  return (
    <div
      className={cn(
        "bg-background z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-linear-to-b px-4 py-2.5 sm:sticky sm:top-12 lg:px-5",
        SITE_CHANGES_STRIP_TONES[tone]
      )}
      role="alert"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 self-start"
        icon={Alert02Icon}
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

/** Save failures, invalid config and conflicts, shown once above the page content. Unpublished edits live in the site header. */
export function SiteChangesBanner() {
  const state = useSiteWorkspace();
  const load = useSiteWorkspaceLoad();
  const { organizationSlug, detail } = useSite();
  const { current } = useSiteNavSection(organizationSlug, detail.site.id);
  // Without a workspace the Design page shows the failure in place of its form.
  if (load.failed && (state || current !== "design")) {
    return <SiteLoadFailedStrip />;
  }
  if (!state || state.malformed) {
    return null;
  }
  return <SiteChangesStrip state={state} />;
}

function SiteLoadFailedStrip() {
  const t = useTranslations("sites.design");
  const load = useSiteWorkspaceLoad();
  return (
    <Strip
      description={t("errors.loadDescription")}
      title={t("errors.loadTitle")}
      tone="destructive"
    >
      <Button
        loading={load.retrying}
        size="sm"
        variant="outline"
        onClick={load.retry}
      >
        {t("workspace.tryAgain")}
      </Button>
    </Strip>
  );
}

function SiteChangesStrip({ state }: SiteChangesStripStateProps) {
  const t = useTranslations("sites.design.workspace");
  const banner = useTranslations("sites.design.workspace.banner");
  const busy = discardBusy(state);
  const discard = <SiteDiscardChangesButton state={state} />;
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
  return null;
}

function discardBusy(state: SiteWorkspaceValue) {
  return (
    state.readOnly ||
    state.uploading ||
    state.saves.state.status === "saving" ||
    state.controller.props.commitStatus === "pending"
  );
}

/** Unpublished edits sit in the header next to Publish, so the page never shifts. */
export function SiteUnpublishedChanges() {
  const state = useSiteWorkspace();
  if (
    !state ||
    state.malformed ||
    state.conflicts.length > 0 ||
    state.saves.state.status === "error" ||
    state.invalid
  ) {
    return null;
  }
  return <SiteUnpublishedIndicator state={state} />;
}

function SiteUnpublishedIndicator({ state }: SiteChangesStripStateProps) {
  const banner = useTranslations("sites.design.workspace.banner");
  const unpublished = useUnpublishedSummary(state);
  if (!unpublished) {
    return null;
  }
  return (
    <div className="animate-in fade-in-0 flex min-w-0 items-center gap-1 duration-200 motion-reduce:animate-none">
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="text-muted-foreground flex min-w-0 items-center gap-2 px-1.5 text-sm"
              role="status"
            />
          }
        >
          <span
            aria-hidden="true"
            className="bg-info size-1.5 shrink-0 rounded-full"
          />
          <span aria-hidden="true" className="md:hidden">
            {banner("unpublishedShort")}
          </span>
          <span className="truncate max-md:sr-only">{unpublished.title}</span>
          <span className="sr-only">{unpublished.description}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          {unpublished.description}
        </TooltipContent>
      </Tooltip>
      {state.files.drafts.length > 0 || state.unsaved ? (
        <SiteDiscardChangesButton state={state} variant="ghost" />
      ) : null}
    </div>
  );
}

function SiteDiscardChangesButton({
  state,
  variant = "secondary",
}: SiteDiscardChangesButtonProps) {
  const banner = useTranslations("sites.design.workspace.banner");
  const common = useTranslations("common");
  const branches = useTranslations("sites.branches");
  const { discardOpen, setDiscardOpen } = state;
  const [discardError, setDiscardError] = useState(false);
  const busy = discardBusy(state);
  return (
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
        render={<Button disabled={busy} size="sm" variant={variant} />}
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
