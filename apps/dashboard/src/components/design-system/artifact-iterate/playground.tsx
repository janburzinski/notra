"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ITERATE_FINDINGS, ITERATE_IDEA_PLANS } from "./fixtures";
import { SplitView } from "./split";
import { usePostRevisions } from "./use-post-revisions";

/** Notified when `openPost` writes the URL; history.replaceState fires no event. */
const urlListeners = new Set<() => void>();

function subscribeToUrl(listener: () => void) {
  urlListeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    urlListeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function readOpenId() {
  return new URLSearchParams(window.location.search).get("open");
}

/** The server render has no URL, so nothing is open there. */
function readOpenIdOnServer() {
  return null;
}

/** Opening a post puts it in the URL, so a reload lands on it again. */
function openPost(id: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (id) {
    params.set("open", id);
  } else {
    params.delete("open");
  }
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : "?");
  for (const listener of urlListeners) {
    listener();
  }
}

/**
 * Dev-only: open a post from the daily brief artifact and iterate on it.
 * `?open=<finding id>` opens one on load; the URL is the open post's state.
 */
export function ArtifactIteratePlayground() {
  const openId = useSyncExternalStore(
    subscribeToUrl,
    readOpenId,
    readOpenIdOnServer
  );
  const openIdRef = useRef(openId);
  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);
  // Requests keep running when you close the post or move to another; when
  // one finishes out of sight, a toast says so and takes you back to it.
  const revisions = usePostRevisions({
    onFinished: (findingId, version) => {
      if (openIdRef.current === findingId) {
        return;
      }
      const finding = ITERATE_FINDINGS.find((item) => item.id === findingId);
      // A written idea's pull request number comes with its first version.
      const pullRequest =
        finding?.pullRequestNumber ??
        ITERATE_IDEA_PLANS[findingId]?.pullRequestNumber;
      const where = pullRequest ? `#${pullRequest}` : "the pull request";
      toast.success(
        version.number === 1
          ? `Draft committed to ${where}`
          : `Version ${version.number} committed to ${where}`,
        {
          description: finding?.title.replace(/^Blog post:\s*/u, ""),
          action: { label: "View", onClick: () => openPost(findingId) },
        }
      );
    },
  });

  return (
    <SplitView openId={openId} revisions={revisions} setOpenId={openPost} />
  );
}
