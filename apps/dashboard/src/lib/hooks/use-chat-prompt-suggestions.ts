"use client";

import {
  AiBrowserIcon,
  Github01Icon,
  PencilEdit02Icon,
  Rocket01Icon,
  Sent02Icon,
} from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useFormatter, useTranslations } from "use-intl";

import {
  CHAT_HOME_SUGGESTION_COUNT,
  CHAT_HOME_STARTER_IDS,
  DASHBOARD_AGENT_SUGGESTIONS,
} from "@/constants/chat-suggestions";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ChatSuggestionSignal } from "@/types/chat";
import type { ChatPromptSuggestion } from "@/types/components/chat-suggestions";

const SUGGESTIONS_STALE_MS = 5 * 60 * 1000;

/**
 * Prompt suggestions for the empty chat screen. Workspace signals (latest
 * draft, top AI search gap, a shipped feature request, a connected repo) come
 * first; starters fill the remaining slots so the grid is always full.
 */
export function useChatPromptSuggestions({
  organizationId,
  projectId,
  enabled,
}: {
  organizationId: string;
  projectId: string | null;
  enabled: boolean;
}) {
  const t = useTranslations("chat.suggestions");
  const format = useFormatter();
  const query = useQuery({
    ...dashboardOrpc.chat.suggestions.queryOptions({
      input: { organizationId, projectId },
    }),
    enabled: enabled && organizationId.length > 0,
    staleTime: SUGGESTIONS_STALE_MS,
  });

  const brandName = query.data?.brandName ?? null;
  const hasGeo = query.data?.hasGeo ?? false;
  const signals = query.data?.signals;

  const suggestions = useMemo(() => {
    const now = new Date();
    const toSuggestion = (
      signal: ChatSuggestionSignal
    ): ChatPromptSuggestion | null => {
      switch (signal.kind) {
        case "draft": {
          return {
            id: `draft-${signal.postId}`,
            source: "draft",
            icon: PencilEdit02Icon,
            title: t("personal.draft.title", { title: signal.title }),
            description: t("personal.draft.description", {
              ago: format.relativeTime(new Date(signal.updatedAt), now),
            }),
            prompt: t("personal.draft.prompt", {
              title: signal.title,
              postId: signal.postId,
            }),
          };
        }
        case "gap": {
          return {
            id: `gap-${signal.prompt}`,
            source: "gap",
            icon: AiBrowserIcon,
            title: t("personal.gap.title", { prompt: signal.title }),
            description: signal.competitor
              ? t("personal.gap.description", {
                  competitor: signal.competitor,
                })
              : t("personal.gap.descriptionUnnamed"),
            prompt: t("personal.gap.prompt", { prompt: signal.prompt }),
          };
        }
        case "shipped": {
          return {
            id: `shipped-${signal.feedbackId}`,
            source: "shipped",
            icon: Rocket01Icon,
            title: t("personal.shipped.title", { title: signal.title }),
            description: t("personal.shipped.description", {
              ago: format.relativeTime(new Date(signal.resolvedAt), now),
            }),
            prompt: t("personal.shipped.prompt", { title: signal.title }),
          };
        }
        case "repo": {
          return {
            id: `repo-${signal.owner}/${signal.repo}`,
            source: "repo",
            icon: Github01Icon,
            title: t("personal.repo.title", { repo: signal.repo }),
            description: t("personal.repo.description", {
              owner: signal.owner,
              repo: signal.repo,
            }),
            prompt: t("personal.repo.prompt", {
              owner: signal.owner,
              repo: signal.repo,
            }),
          };
        }
        default: {
          // An older bundle can receive a kind added later; skip it.
          return null;
        }
      }
    };

    const personal = (signals ?? []).flatMap((signal) => {
      const suggestion = toSuggestion(signal);
      return suggestion ? [suggestion] : [];
    });
    const hasRepo = personal.some((item) => item.source === "repo");
    const starters: ChatPromptSuggestion[] = [];

    if (brandName) {
      starters.push({
        id: "brand-social",
        source: "brand",
        icon: Sent02Icon,
        title: t("personal.socialPost.title", { brand: brandName }),
        description: t("personal.socialPost.description"),
        prompt: t("personal.socialPost.prompt", { brand: brandName }),
      });
    }

    for (const id of CHAT_HOME_STARTER_IDS) {
      const skip =
        (id === "releaseNotes" && hasRepo) ||
        (id === "geoStatus" && !hasGeo) ||
        (id === "socialPost" && brandName !== null);
      const starter = DASHBOARD_AGENT_SUGGESTIONS.find(
        (item) => item.id === id
      );
      if (skip || !starter) {
        continue;
      }
      starters.push({
        id: `starter-${id}`,
        source: "starter",
        icon: starter.icon,
        title: t(`items.${id}.title`),
        description: t(`items.${id}.description`),
        prompt: t(`items.${id}.prompt`),
      });
    }

    return [...personal, ...starters].slice(0, CHAT_HOME_SUGGESTION_COUNT);
  }, [brandName, format, hasGeo, signals, t]);

  const isPersonal = suggestions.some((item) => item.source !== "starter");
  let heading = t("heading");
  if (isPersonal && brandName) {
    heading = t("personalHeading", { brand: brandName });
  } else if (isPersonal) {
    heading = t("personalHeadingFallback");
  }

  return {
    suggestions,
    heading,
    isLoading: query.isPending && query.fetchStatus !== "idle",
  };
}
