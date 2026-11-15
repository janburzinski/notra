import { ARTIFACT_LIMITS } from "@notra/ai/constants/artifacts";
import type { ArtifactBlock, ArtifactContent } from "@notra/ai/types/artifact";
import type { AutopilotBriefContent } from "@notra/db/types/autopilot";

import { AUTOPILOT_BRIEF_ARTIFACT_HEADINGS } from "@/constants/autopilot-brief";

/**
 * Autopilot blocks hold a limited number of items; longer lists continue.
 * A heading reads like the model's section headings above it.
 */
function autopilotBlocks(
  findingIds: string[],
  heading?: string
): ArtifactBlock[] {
  const blocks: ArtifactBlock[] = [];
  if (heading && findingIds.length > 0) {
    blocks.push({ type: "text", markdown: `## ${heading}` });
  }
  for (
    let start = 0;
    start < findingIds.length;
    start += ARTIFACT_LIMITS.findingIds
  ) {
    blocks.push({
      type: "autopilot",
      findingIds: findingIds.slice(start, start + ARTIFACT_LIMITS.findingIds),
    });
  }
  return blocks;
}

/**
 * The daily brief as an artifact: the item to decide first, the model's
 * themed sections with their items live under them, whatever else waits,
 * what merged, and what is worth knowing.
 */
export function buildBriefArtifactContent(
  content: AutopilotBriefContent
): ArtifactContent {
  const blocks: ArtifactBlock[] = [];
  const shown = new Set<string>();
  const headings = content.headings ?? AUTOPILOT_BRIEF_ARTIFACT_HEADINGS;

  if (content.lead) {
    blocks.push(...autopilotBlocks([content.lead.findingId]));
    shown.add(content.lead.findingId);
  }

  for (const section of content.sections) {
    blocks.push({
      type: "text",
      markdown: `## ${section.title}\n\n${section.body}`,
    });
    const ids = section.findingIds.filter((id) => !shown.has(id));
    blocks.push(...autopilotBlocks(ids));
    for (const id of ids) {
      shown.add(id);
    }
  }

  const waiting = content.findingIds.filter((id) => !shown.has(id));
  blocks.push(
    ...autopilotBlocks(
      waiting,
      shown.size > 0 ? headings.alsoWaiting : headings.waiting
    )
  );
  const merged = content.mergedIds.filter((id) => !shown.has(id));
  blocks.push(...autopilotBlocks(merged, headings.merged));

  if (content.insights.length > 0) {
    blocks.push({
      type: "text",
      markdown: [
        `## ${headings.worthKnowing}`,
        "",
        ...content.insights.map((line) => `- ${line}`),
      ].join("\n"),
    });
  }
  // With nothing to list, the summary is the whole brief: shown once, as its
  // text, instead of under the title and again as the only block.
  if (blocks.length === 0) {
    return {
      title: content.headline,
      blocks: [{ type: "text", markdown: content.summary }],
    };
  }

  return {
    title: content.headline,
    ...(content.summary ? { summary: content.summary } : {}),
    blocks: blocks.slice(0, ARTIFACT_LIMITS.blocks),
  };
}
