"use client";

import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { SiteBranchPrimaryActionProps } from "@/types/site-branches";
import { siteBranchPrimaryState } from "@/utils/site-branch-primary-state";

export function SiteBranchPrimaryAction(props: SiteBranchPrimaryActionProps) {
  const t = useTranslations("sites.branches");
  const state = siteBranchPrimaryState(props);
  const pr = props.status?.pullRequest;
  const actions = {
    create: props.onCreate,
    publish: props.onPublish,
    requestReview: () => props.onReview(false),
    merge: () => props.onReview(true),
  };
  return (
    <>
      {state.showSave ? (
        <Button
          variant="outline"
          disabled={props.busy || props.unsaved}
          onClick={props.onFlush}
        >
          {t("saveNow")}
        </Button>
      ) : null}
      <Button
        disabled={state.disabled}
        loading={props.busy}
        onClick={actions[state.action]}
      >
        {t(state.action)}
      </Button>
      {state.action === "merge" && pr?.mergeable === "CONFLICTING" ? (
        <p className="text-destructive w-full text-xs" role="alert">
          {t("mergeConflicts")}{" "}
          <a
            className="underline"
            href={pr.url}
            target="_blank"
            rel="noreferrer"
          >
            {t("openPullRequest")}
          </a>
        </p>
      ) : null}
    </>
  );
}
