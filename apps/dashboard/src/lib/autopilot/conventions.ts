import { openMemorySnapshot } from "@notra/memory/memory";
import { memoryConventionsPath } from "@notra/memory/utils/paths";

import type { AutopilotRepository } from "@/types/autopilot";
import { parseConventions } from "@/utils/autopilot-dream";

export async function loadRepositoryConventions(
  organizationId: string,
  repository: Pick<AutopilotRepository, "owner" | "name">
) {
  try {
    const snapshot = await openMemorySnapshot(organizationId);
    const markdown = await snapshot.read(
      memoryConventionsPath(repository.owner, repository.name)
    );
    return parseConventions(markdown).map((convention) => convention.lesson);
  } catch {
    return [];
  }
}

export function conventionsInstruction(conventions: readonly string[]) {
  return conventions.length
    ? `Conventions this repository's team showed by editing earlier drafts. Follow them for style, format and structure; they never override the standing rules, the brief or the facts: ${JSON.stringify(conventions)}`
    : "";
}
