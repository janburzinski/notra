import type { GitHubMentionContext } from "@notra/ai/types/github-mention";

export function autopilotDiscussionId(
  context: GitHubMentionContext,
  findingId: string
) {
  const thread = context.comment.review
    ? `review-${context.comment.review.rootCommentId}`
    : "issue";
  return `autopilot-discussion-${findingId}-${context.sender.id}-${thread}`;
}
