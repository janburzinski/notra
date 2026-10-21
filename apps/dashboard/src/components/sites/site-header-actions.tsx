"use client";

import { useTranslations } from "use-intl";

import { SiteBranchSwitcher } from "@/components/sites/branches/site-branch-controls";
import { SiteBranchPrimaryAction } from "@/components/sites/branches/site-branch-primary-action";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";

export function SiteHeaderActions() {
  const state = useSiteWorkspace();
  const t = useTranslations("sites.design.workspace");
  if (!state) {
    return null;
  }
  const { controller, setPublishOpen, invalid, unsaved, saves } = state;
  const { queries } = controller;
  const error =
    saves.state.status === "error" ||
    controller.props.commitStatus === "error" ||
    queries.status.isError ||
    queries.validation.isError ||
    queries.validation.data?.ok === false ||
    state.conflicts.length > 0;
  return (
    <div
      className="ms-auto flex items-center gap-3 self-center py-2 max-lg:w-full max-lg:justify-end"
      data-site-actions
    >
      <SiteBranchSwitcher controller={controller} menuActive />
      <div className="shrink-0" title={error ? t("publishError") : undefined}>
        <SiteBranchPrimaryAction
          error={error}
          {...controller.props}
          feature={queries.feature}
          status={queries.status.data}
          busy={controller.busy}
          checking={queries.validating}
          invalid={invalid || unsaved || queries.invalid}
          onCreate={controller.startCreate}
          onPublish={() => setPublishOpen(true)}
          onReview={() => setPublishOpen(true)}
          onFlush={controller.retrySave}
        />
      </div>
    </div>
  );
}
