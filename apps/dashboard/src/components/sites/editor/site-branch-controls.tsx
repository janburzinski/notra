"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteBranchDialog } from "@/components/sites/editor/site-branch-dialog";
import { SiteBranchMenu } from "@/components/sites/editor/site-branch-menu";
import { SiteBranchPrimaryAction } from "@/components/sites/editor/site-branch-primary-action";
import { useSiteBranchActions } from "@/lib/hooks/use-site-branch-actions";
import { useSiteBranchQueries } from "@/lib/hooks/use-site-branch-queries";
import type {
  SiteBranchControlsProps,
  SiteBranchDialogProps,
  SiteBranchOptionsMenuProps,
} from "@/types/site-branches";
import { toErrorMessage } from "@/utils/error-message";
import { toggleSiteBranchVisibility } from "@/utils/site-branch-visibility";

function SiteBranchOptionsMenu({
  disabled,
  showBranches,
  onNewBranch,
}: SiteBranchOptionsMenuProps) {
  const t = useTranslations("sites.branches");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" disabled={disabled} />}
        aria-label={t("moreOptions")}
      >
        ⋯
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={showBranches}
          onCheckedChange={toggleSiteBranchVisibility}
        >
          {t("branches")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onClick={onNewBranch}>
          {t("newBranch")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteBranchControls(props: SiteBranchControlsProps) {
  const {
    productionBranch,
    draftCount,
    unsaved,
    onSwitch,
    onPublish,
    onFlush,
  } = props;
  const t = useTranslations("sites.branches");
  const queries = useSiteBranchQueries(props);
  const { status, current } = queries;
  const [action, setAction] = useState<SiteBranchDialogProps["action"]>(null);
  const [switching, setSwitching] = useState(false);
  const mutations = useSiteBranchActions(props, action, () => setAction(null));
  const busy =
    mutations.edit.isPending || mutations.review.isPending || switching;
  const flushWithToast = () =>
    onFlush().catch((error: unknown) =>
      toast.error(toErrorMessage(error, t("saveFailed")))
    );
  const switchTo = (next: string) => {
    setSwitching(true);
    void onFlush()
      .then(onSwitch.bind(null, next))
      .catch((error: unknown) =>
        toast.error(toErrorMessage(error, t("saveFailed")))
      )
      .then(() => setSwitching(false));
  };
  const create = () => setAction({ kind: "create", branch: current });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {queries.canShow ? (
        <SiteBranchMenu
          open={queries.menuOpen}
          onOpenChange={queries.setMenuOpen}
          current={current}
          productionBranch={productionBranch}
          entries={queries.branches.data ?? []}
          loading={queries.branches.isPending}
          disabled={busy || unsaved}
          search={queries.search}
          onSearch={queries.setSearch}
          onSelect={switchTo}
          onAction={setAction}
        />
      ) : null}
      <SiteBranchOptionsMenu
        disabled={busy || unsaved}
        showBranches={queries.showBranches}
        onNewBranch={create}
      />
      <span
        className="text-muted-foreground text-xs tabular-nums"
        aria-live="polite"
      >
        {t("pending", { count: draftCount })}
      </span>
      <SiteBranchPrimaryAction
        feature={queries.feature}
        status={status.data}
        busy={busy}
        invalid={queries.invalid}
        unsaved={unsaved}
        draftCount={draftCount}
        onCreate={create}
        onPublish={onPublish}
        onReview={(merge) => mutations.review.mutate(merge)}
        onFlush={() => {
          void flushWithToast();
        }}
      />
      {status.isError ? (
        <p className="text-destructive text-xs" role="alert">
          {t("statusFailed")}
        </p>
      ) : null}
      <SiteBranchDialog
        key={action ? `${action.kind}:${action.branch}` : "closed"}
        action={action}
        draftCount={draftCount}
        loading={mutations.edit.isPending}
        onClose={() => setAction(null)}
        onConfirm={(title, bringChanges) =>
          mutations.edit.mutate({ title, bringChanges })
        }
      />
    </div>
  );
}
