import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AUTOPILOT_REVISION_POLL_MS } from "@/constants/autopilot-revisions";
import { findingContentQueryOptions } from "@/lib/hooks/use-finding-content";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotFindingContent,
  AutopilotFindingView,
} from "@/types/autopilot";
import type {
  AutopilotPostChanges,
  AutopilotRevisionConversation,
  AutopilotRevisionResult,
} from "@/types/autopilot-revisions";
import {
  latestRevisionReply,
  summarizeRevisionReply,
} from "@/utils/autopilot-revisions";
import { toErrorMessage } from "@/utils/error-message";
import { diffBlocks } from "@/utils/inline-diff";

/** What a commit changed in each post, against the version on screen before it. */
function changesBetween(
  before: AutopilotFindingContent,
  after: AutopilotFindingContent
): AutopilotPostChanges {
  const previous = new Map(before.posts.map((post) => [post.path, post]));
  const posts: AutopilotPostChanges["posts"] = {};
  for (const post of after.posts) {
    const old = previous.get(post.path);
    const diff = diffBlocks(old?.body ?? "", post.body);
    const titleBefore =
      old && old.title !== post.title ? (old.title ?? null) : null;
    if (
      diff.changed.length > 0 ||
      Object.keys(diff.removed).length > 0 ||
      titleBefore !== null
    ) {
      posts[post.path] = {
        ...diff,
        titleBefore,
        imagesBefore: old?.images ?? {},
      };
    }
  }
  return { headSha: after.headSha, posts };
}

/** The version on screen, and what the latest commit changed in it. */
function useShownContent(content: AutopilotFindingContent | null) {
  const [shown, setShown] = useState<AutopilotFindingContent | null>(null);
  const [changes, setChanges] = useState<AutopilotPostChanges | null>(null);
  if (content && shown?.headSha !== content.headSha) {
    setShown(content);
    setChanges(shown ? changesBetween(shown, content) : null);
  }
  return { shown, changes };
}

/**
 * How a request that finished while the page was open went. The commit it
 * started from is saved when it starts, so a commit that showed up before
 * the agent's reply still counts as the request's commit.
 */
function useRevisionResult(
  working: boolean,
  conversation: AutopilotRevisionConversation | undefined
) {
  const [watched, setWatched] = useState(false);
  const [startSha, setStartSha] = useState<string | null>(null);
  const [result, setResult] = useState<AutopilotRevisionResult | null>(null);
  if (working !== watched) {
    setWatched(working);
    if (working) {
      setResult(null);
      setStartSha(conversation?.headSha ?? null);
    } else if (conversation) {
      const reply = latestRevisionReply(conversation.comments);
      setResult({
        commitSha:
          startSha && conversation.headSha !== startSha
            ? conversation.headSha
            : null,
        note: reply ? summarizeRevisionReply(reply.body) : null,
        replyUrl: reply?.htmlUrl ?? null,
      });
    }
  }
  return result;
}

/**
 * Asking Autopilot for changes to an item's pull request, from its page. The
 * request is a comment on the pull request that the GitHub agent answers, so
 * the pull request's comments say whether it is still working, even after a
 * reload. Each commit it pushes reads as a diff against the version before.
 */
export function useFindingRevisions(
  organizationId: string,
  finding: AutopilotFindingView
) {
  const queryClient = useQueryClient();
  const input = { organizationId, findingId: finding.id };
  const conversation = useQuery({
    ...dashboardOrpc.autopilot.conversation.queryOptions({ input }),
    enabled: finding.pullRequestNumber !== null,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.working ? AUTOPILOT_REVISION_POLL_MS : false,
  });
  // The pull request's own head, so a commit shows as soon as it lands.
  const headSha = conversation.data?.headSha ?? finding.headSha;
  const content = useQuery({
    ...findingContentQueryOptions(organizationId, { ...finding, headSha }),
    // The version before stays on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
  const request = useMutation({
    mutationFn: (instruction: string) =>
      dashboardOrpc.autopilot.requestChanges.call({ ...input, instruction }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.conversation.key({ input }),
      }),
  });

  const working = request.isPending || conversation.data?.working === true;
  const { shown, changes } = useShownContent(
    content.isPlaceholderData ? null : (content.data ?? null)
  );
  const result = useRevisionResult(working, conversation.data);
  // The merge pin moved with the commit, so the item is read again.
  useEffect(() => {
    if (result) {
      void queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
    }
  }, [queryClient, result]);
  const lastRequest = conversation.data?.comments.findLast(
    (comment) => comment.isRequest
  );

  return {
    loading: content.isPending,
    failed: content.isError,
    shown,
    changes,
    working,
    startedAt: lastRequest
      ? Date.parse(lastRequest.createdAt)
      : request.submittedAt,
    result,
    ask: (instruction: string) => request.mutate(instruction),
    error: request.error
      ? toErrorMessage(request.error, "Couldn't send the request")
      : null,
    clearError: () => request.reset(),
  };
}
