import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { ITERATE_POSTS } from "./fixtures";

/**
 * Stands in for `autopilot.findingContent`, which reads the pull request
 * from GitHub in three to four round trips: about a second in production.
 */
const FAKE_GITHUB_MS = 1200;

export function postContentQueryOptions(findingId: string) {
  return queryOptions({
    queryKey: ["design-system", "artifact-iterate", "post", findingId],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, FAKE_GITHUB_MS));
      return ITERATE_POSTS[findingId] ?? null;
    },
    // A post at one commit never changes; the real key carries the head SHA.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Starts reading a post before it's opened: on hover, or as a neighbour. */
export function prefetchPostContent(
  queryClient: QueryClient,
  findingId: string
) {
  if (!ITERATE_POSTS[findingId]) {
    return;
  }
  void queryClient.prefetchQuery(postContentQueryOptions(findingId));
}
