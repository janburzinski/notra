import type {
  ChatAttachment,
  ContextItem,
  TextSelection,
} from "@notra/ai/types/chat";

import type {
  ChatContextOption,
  EnabledLinear,
  EnabledRepo,
} from "@/types/components/chat-input";

export function getRemainingChatCredits(remaining: unknown): number | null {
  if (typeof remaining === "number") {
    return remaining;
  }
  return null;
}

export function isChatUsageBlocked(
  allowed: boolean | undefined,
  chatIncludedInPlan: boolean
): boolean {
  return allowed === false && !chatIncludedInPlan;
}

export function shouldShowLowChatCredits(
  chatIncludedInPlan: boolean,
  remainingChatCredits: number | null
): boolean {
  return (
    !chatIncludedInPlan &&
    remainingChatCredits !== null &&
    remainingChatCredits > 0 &&
    remainingChatCredits <= 10
  );
}

export function resolveUsageLimitError(
  externalError: string | null | undefined,
  internalError: string | null,
  isUsageBlocked: boolean,
  limitMessage: string
): string | null {
  if (externalError) {
    return externalError;
  }
  if (internalError) {
    return internalError;
  }
  if (isUsageBlocked) {
    return limitMessage;
  }
  return null;
}

export function getSelectionPreview(selection: TextSelection) {
  return selection.text.length > 150
    ? `${selection.text.slice(0, 150)}...`
    : selection.text;
}

function toGithubContextItem(repo: EnabledRepo): ContextItem {
  return {
    type: "github-repo",
    owner: repo.owner,
    repo: repo.repo,
    integrationId: repo.integrationId,
  };
}

export function contextItemsEqual(a: ContextItem, b: ContextItem): boolean {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === "github-repo" && b.type === "github-repo") {
    return a.owner === b.owner && a.repo === b.repo;
  }
  if (a.type === "linear-team" && b.type === "linear-team") {
    return a.integrationId === b.integrationId;
  }
  if (a.type === "mcp-server" && b.type === "mcp-server") {
    return a.integrationId === b.integrationId;
  }
  return false;
}

export function contextItemKey(item: ContextItem): string {
  if (item.type === "github-repo") {
    return `github:${item.integrationId}:${item.owner}/${item.repo}`;
  }
  return `${item.type}:${item.integrationId}`;
}

export function buildContentChatContextOptions({
  enabledRepos,
  enabledLinear,
  labels,
}: {
  enabledRepos: EnabledRepo[];
  enabledLinear: EnabledLinear[];
  labels: { githubRepository: string; linearTeam: string };
}): ChatContextOption[] {
  const options: ChatContextOption[] = [];

  for (const repo of enabledRepos) {
    const label = `${repo.owner}/${repo.repo}`;
    options.push({
      id: `github-${repo.id}`,
      kind: "github",
      label,
      description: labels.githubRepository,
      searchText: `${label} GitHub repository`,
      contextItem: toGithubContextItem(repo),
    });
  }

  for (const integration of enabledLinear) {
    options.push({
      id: `linear-${integration.integrationId}`,
      kind: "linear",
      label: integration.displayName,
      description: labels.linearTeam,
      searchText: `${integration.displayName} ${integration.teamName ?? ""} Linear team`,
      contextItem: {
        type: "linear-team",
        integrationId: integration.integrationId,
        teamName: integration.teamName ?? undefined,
      },
    });
  }

  return options;
}

/** Short type label for a file tile, e.g. "pdf" from "brief.pdf" or "application/pdf". */
export function getAttachmentExtension(
  filename?: string,
  mediaType?: string
): string | null {
  const fromName = filename?.includes(".")
    ? filename.split(".").pop()
    : undefined;
  if (fromName) {
    return fromName;
  }
  return mediaType?.split("/")[1]?.split(/[+.;]/)[0] ?? null;
}

/** Appends files that are not already in the list, keeping order. */
export function mergeChatAttachments(
  current: ChatAttachment[],
  next: ChatAttachment[]
): ChatAttachment[] {
  const keys = new Set(current.map((attachment) => attachment.key));
  return [
    ...current,
    ...next.filter((attachment) => {
      if (keys.has(attachment.key)) {
        return false;
      }
      keys.add(attachment.key);
      return true;
    }),
  ];
}

const GENERIC_PASTED_IMAGE_NAME_RE = /^image\.(jpe?g|png|gif|webp)$/i;

/** Pasted screenshots come in as "image.png"; give each a unique name. */
export function renamePastedFiles(files: File[]): File[] {
  const pasteTimestamp = Date.now();
  return files.map((file, index) => {
    const hasMeaningfulName =
      file.name && !GENERIC_PASTED_IMAGE_NAME_RE.test(file.name);
    if (hasMeaningfulName) {
      return file;
    }
    const extFromType = file.type.split("/")[1]?.split("+")[0];
    const extFromName = file.name?.includes(".")
      ? file.name.split(".").pop()
      : undefined;
    const ext = extFromName ?? extFromType ?? "png";
    const suffix = index === 0 ? "" : `-${index}`;
    return new File([file], `pasted-${pasteTimestamp}${suffix}.${ext}`, {
      type: file.type,
      lastModified: file.lastModified,
    });
  });
}
