"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  MessageResponse,
  type MessageResponseProps,
} from "@notra/ui/components/ai-elements/message";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import type { ComponentProps } from "react";

import {
  AutopilotBriefFindingActions,
  AutopilotBriefFindingWhy,
} from "@/components/autopilot/autopilot-brief-finding-card";
import Link from "@/components/framework/link";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import { AUTOPILOT_KIND_META } from "@/constants/autopilot-ui";
import { useFindingContent } from "@/lib/hooks/use-finding-content";
import type {
  AutopilotBriefItemDialogProps,
  AutopilotBriefItemViewProps,
  AutopilotFindingChangedFile,
  AutopilotFindingContent,
  AutopilotFindingView,
} from "@/types/autopilot";
import {
  findingDisplayTitle,
  findingSummary,
} from "@/utils/autopilot-findings";

/**
 * One brief item opened up without leaving the brief: the post its pull
 * request writes, to read before merging or closing it.
 */
export function AutopilotBriefItemDialog({
  finding,
  onOpenChange,
  ...props
}: AutopilotBriefItemDialogProps) {
  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={finding !== null}>
      {finding ? (
        <ResponsiveDialogContent className="flex max-h-[88svh] flex-col sm:max-w-3xl">
          <ItemView finding={finding} key={finding.id} {...props} />
        </ResponsiveDialogContent>
      ) : null}
    </ResponsiveDialog>
  );
}

function ItemView({
  finding,
  organizationId,
  organizationSlug,
  ...actions
}: AutopilotBriefItemViewProps) {
  const content = useFindingContent(organizationId, finding);
  // One post heads the modal with its own title; several each carry theirs.
  const posts = content.data?.posts ?? [];
  const post = posts.length === 1 ? posts[0] : null;

  return (
    <>
      <ItemBar finding={finding} organizationSlug={organizationSlug} />
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>
          {post?.title ?? findingDisplayTitle(finding)}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          {post?.description ?? findingSummary(finding)}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      {/* On a phone the sheet pads its children; the dialog pads itself. */}
      <div className="min-h-0 flex-1 overflow-y-auto sm:-mx-1 sm:px-1">
        <div className="mb-4">
          <AutopilotBriefFindingWhy finding={finding} />
        </div>
        <ItemReader finding={finding} organizationId={organizationId} />
      </div>
      <div className="border-table-row-border flex flex-wrap items-center justify-end gap-2 border-t pt-3 pb-4 sm:pb-0">
        <AutopilotBriefFindingActions
          {...actions}
          finding={finding}
          title={findingDisplayTitle(finding)}
        />
      </div>
    </>
  );
}

/** Kind, pull request and a link to the details page, above the post. */
function ItemBar({
  finding,
  organizationSlug,
}: {
  finding: AutopilotFindingView;
  organizationSlug: string;
}) {
  const meta = AUTOPILOT_KIND_META[finding.kind];
  const linkClass =
    "hover:text-foreground underline-offset-4 transition-colors hover:underline";
  return (
    <div className="text-muted-foreground pt-4 pr-8 text-xs sm:pt-0">
      <p className="flex min-w-0 items-center gap-1.5">
        <HugeiconsIcon
          aria-hidden="true"
          icon={meta.icon}
          size={14}
          strokeWidth={1.5}
        />
        <span>{meta.label}</span>
        {finding.pullRequestUrl ? (
          <>
            <span aria-hidden="true">·</span>
            <a
              className={linkClass}
              href={finding.pullRequestUrl}
              rel="noreferrer"
              target="_blank"
            >
              PR #{finding.pullRequestNumber}
            </a>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <Link
          className={linkClass}
          href={`/${organizationSlug}${AUTOPILOT_NAV_LINK}/findings/${finding.id}`}
        >
          Details
        </Link>
      </p>
    </div>
  );
}

function ItemReader({
  finding,
  organizationId,
}: {
  finding: AutopilotFindingView;
  organizationId: string;
}) {
  const content = useFindingContent(organizationId, finding);
  if (!finding.pullRequestNumber) {
    return (
      <p className="text-muted-foreground text-sm text-pretty">
        {finding.status === "suggested"
          ? "Nothing is written yet. Write it, and the draft shows up here to read before you merge."
          : "This item has no pull request to show."}
      </p>
    );
  }
  if (content.isPending) {
    return (
      <div aria-busy="true" className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-6 h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  const data = content.data;
  if (!data) {
    return <ReadFailed pullRequestUrl={finding.pullRequestUrl} />;
  }
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {data.posts.map((post) => (
          <article className="space-y-3" key={post.path}>
            {data.posts.length > 1 ? (
              <div className="space-y-1">
                <p className="text-muted-foreground font-mono text-xs">
                  {post.path}
                </p>
                {post.title ? (
                  <h3 className="text-foreground text-base font-semibold text-pretty">
                    {post.title}
                  </h3>
                ) : null}
              </div>
            ) : null}
            <MessageResponse
              className="text-sm leading-relaxed"
              components={postImageComponents(post.images)}
              mode="static"
            >
              {post.body}
            </MessageResponse>
          </article>
        ))}
      </div>
      <OtherFiles content={data} />
    </div>
  );
}

/**
 * Shows the pull request's own images, which the server read and keyed in
 * the body. Data URLs can't go in the Markdown: the renderer blocks them, so
 * they are swapped in on the rendered <img>, where an SVG can't run scripts.
 */
function postImageComponents(
  images: Record<string, string>
): MessageResponseProps["components"] {
  if (Object.keys(images).length === 0) {
    return undefined;
  }
  return {
    img: ({
      alt,
      node: _node,
      src,
      ...props
    }: ComponentProps<"img"> & { node?: unknown }) => (
      <img
        {...props}
        alt={alt ?? ""}
        className="max-w-full rounded-lg"
        src={typeof src === "string" ? (images[src] ?? src) : src}
      />
    ),
  };
}

function ReadFailed({ pullRequestUrl }: { pullRequestUrl: string | null }) {
  return (
    <p className="text-muted-foreground text-sm text-pretty">
      Couldn't read this pull request from GitHub.
      {pullRequestUrl ? (
        <>
          {" "}
          <a
            className="text-foreground underline-offset-4 hover:underline"
            href={pullRequestUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open it on GitHub
          </a>{" "}
          instead.
        </>
      ) : null}
    </p>
  );
}

function OtherFiles({ content }: { content: AutopilotFindingContent }) {
  const { posts, otherFiles, hiddenFiles } = content;
  return (
    <>
      {otherFiles.length > 0 ? (
        <div className="space-y-2">
          {posts.length > 0 ? (
            <p className="text-muted-foreground text-xs font-medium">
              Also changes
            </p>
          ) : null}
          {otherFiles.map((file) => (
            <ChangedFile file={file} key={file.path} />
          ))}
        </div>
      ) : null}
      {hiddenFiles > 0 ? (
        <p className="text-muted-foreground text-xs">
          {hiddenFiles} more {hiddenFiles === 1 ? "file" : "files"} on GitHub.
        </p>
      ) : null}
    </>
  );
}

function ChangedFile({ file }: { file: AutopilotFindingChangedFile }) {
  return (
    <details className="border-table-row-border rounded-lg border">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs">
        <span className="truncate font-mono">{file.path}</span>
        <span className="shrink-0 tabular-nums">
          <span className="text-success">+{file.additions}</span>{" "}
          <span className="text-destructive">−{file.deletions}</span>
        </span>
      </summary>
      {file.patch ? (
        <pre className="border-table-row-border overflow-x-auto border-t px-3 py-2 font-mono text-xs leading-5">
          {file.patch}
        </pre>
      ) : null}
    </details>
  );
}
