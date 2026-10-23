"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { SiteBranchPrimaryActionProps } from "@/types/site-branches";
import { siteBranchPrimaryState } from "@/utils/site-branch-primary-state";

/** Production with nothing left to publish says so instead of a dead button. */
function showsPublished(
  props: SiteBranchPrimaryActionProps,
  action: ReturnType<typeof siteBranchPrimaryState>["action"]
) {
  return Boolean(
    props.showPublished &&
    action === "publish" &&
    props.status?.canPublishDirect &&
    props.draftCount === 0 &&
    !(props.unsaved || props.busy || props.checking || props.error)
  );
}

function PublishedButton() {
  const t = useTranslations("sites.branches");
  return (
    <Button disabled size="sm" variant="secondary">
      <HugeiconsIcon
        aria-hidden="true"
        data-icon="inline-start"
        icon={Tick02Icon}
      />
      {t("published")}
    </Button>
  );
}

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
  if (showsPublished(props, state.action)) {
    return <PublishedButton />;
  }
  return (
    <>
      <Button
        data-dialog-confirm
        size="sm"
        aria-describedby={props.describedBy}
        disabled={state.disabled && !props.error}
        loading={props.busy}
        aria-busy={props.busy || props.checking || undefined}
        onClick={props.error ? props.onPublish : actions[state.action]}
      >
        {props.checking ? (
          <Spinner aria-hidden="true" className="size-3" />
        ) : null}
        {props.error ? t("reviewIssues") : t(state.action)}
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
