"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef } from "react";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  GitHubPublishAutoPublishOptions,
  GitHubPublishOnlySiteOptions,
} from "@/types/content/detail";

/**
 * The organization's only Notra site for a post that isn't on GitHub yet.
 * With one site there is nothing to choose, so the dialog publishes to it.
 */
export function useGitHubPublishOnlySite({
  organizationId,
  contentId,
  enabled,
}: GitHubPublishOnlySiteOptions) {
  const query = useQuery(
    dashboardOrpc.sites.previews.sitesForPost.queryOptions({
      input: { organizationId, postId: contentId },
      enabled,
      // Recount on every open; a site added since must stop auto publishing.
      staleTime: 0,
    })
  );
  return {
    onlySite: enabled && query.data?.length === 1 ? query.data[0] : undefined,
    loading: enabled && query.isFetching,
  };
}

/** Publishes once each time the dialog opens and everything is ready. */
export function useGitHubAutoPublish({
  open,
  ready,
  publish,
}: GitHubPublishAutoPublishOptions) {
  const started = useRef(false);
  const run = useEffectEvent(publish);
  useEffect(() => {
    if (!open) {
      started.current = false;
      return;
    }
    if (ready && !started.current) {
      started.current = true;
      run();
    }
  }, [open, ready]);
}
