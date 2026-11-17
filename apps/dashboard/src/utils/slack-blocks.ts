import type { SlackBlockElement } from "@/types/slack-relay";

function readArray(value: unknown, key: string): readonly unknown[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field : [];
}

/** Finds a button anywhere in Slack blocks, including container `child_blocks`. */
export function findSlackButton(
  blocks: readonly unknown[],
  matches: (element: SlackBlockElement) => boolean
): SlackBlockElement | null {
  for (const block of blocks) {
    for (const element of readArray(block, "elements")) {
      if (element && typeof element === "object") {
        const candidate = element as SlackBlockElement;
        if (matches(candidate)) {
          return candidate;
        }
      }
    }
    const nested = findSlackButton(readArray(block, "child_blocks"), matches);
    if (nested) {
      return nested;
    }
  }
  return null;
}

/**
 * eve names a request's buttons `eve_input:<kind>:<interactionId>:button:<n>`,
 * for example `eve_input:tool-approval:zu96…:button:1`.
 */
export function isEveInteractionButton(
  actionId: string | undefined,
  interactionId: string
): boolean {
  const parts = actionId?.split(":") ?? [];
  return (
    parts[0] === "eve_input" &&
    parts.at(-3) === interactionId &&
    parts.at(-2) === "button"
  );
}
