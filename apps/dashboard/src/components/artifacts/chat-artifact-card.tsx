"use client";

import { Analytics01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslations } from "use-intl";

import { ARTIFACT_PRELOAD_STALE_MS } from "@/constants/artifacts";
import { artifactQueryOptions, useArtifact } from "@/lib/hooks/use-artifact";
import type { ChatArtifactCardProps } from "@/types/artifacts";

/**
 * An artifact in the chat's answer: its title and summary, opening into the
 * side panel. Both come with the tool's output, so the card draws at once;
 * replies saved before the output carried a summary load it instead.
 */
export function ChatArtifactCard({
  organizationId,
  artifactId,
  title,
  summary: savedSummary,
  version,
  onOpen,
}: ChatArtifactCardProps) {
  const t = useTranslations("artifacts");
  const queryClient = useQueryClient();
  const { data, isError } = useArtifact({
    organizationId,
    artifactId,
    version,
    enabled: savedSummary === undefined,
  });
  const summary = savedSummary === undefined ? data?.summary : savedSummary;
  const gone = isError && !data;
  // Load the artifact as soon as its card is on screen, so the panel opens
  // filled instead of on a skeleton. A card for a newer version than the one
  // loaded means the agent just updated it: reload, even in an open panel.
  useEffect(() => {
    const options = artifactQueryOptions({ organizationId, artifactId });
    const loaded = queryClient.getQueryData(options.queryKey);
    if (loaded && loaded.version < version) {
      queryClient
        .invalidateQueries({ queryKey: options.queryKey, exact: true })
        .catch(() => undefined);
      return;
    }
    queryClient
      .prefetchQuery({ ...options, staleTime: ARTIFACT_PRELOAD_STALE_MS })
      .catch(() => undefined);
  }, [artifactId, organizationId, queryClient, version]);

  // The ring sits inside the border: the message around the card clips
  // anything drawn outside it.
  return (
    <button
      className="group border-border bg-card hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 my-1 flex w-full max-w-xl items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset disabled:cursor-default disabled:opacity-60"
      disabled={gone}
      onClick={onOpen}
      type="button"
    >
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-5"
          icon={Analytics01Icon}
          strokeWidth={1.6}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {data?.title ?? title}
        </span>
        <span className="text-muted-foreground line-clamp-1 text-xs">
          {gone
            ? t("gone")
            : (summary ?? `${t("label")} · ${t("versionShort", { version })}`)}
        </span>
      </span>
      {gone ? null : (
        <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center gap-1 text-xs font-medium transition-colors">
          {t("open")}
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5"
            icon={ArrowRight01Icon}
            strokeWidth={2}
          />
        </span>
      )}
    </button>
  );
}
