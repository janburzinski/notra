import { toolOutputArtifactSchema } from "@notra/ai/schemas/artifact";

import { SLACK_ARTIFACT_SUMMARY_MAX } from "../constants/slack";
import { escapeSlackText } from "./text";

/**
 * The thread message for a saved artifact: its title, summary and an Open
 * button. The page itself stays in Notra, behind the workspace login.
 */
export function buildSlackArtifactPost(output: unknown) {
  const parsed = toolOutputArtifactSchema.safeParse(output);
  if (!(parsed.success && parsed.data.url)) {
    return null;
  }
  const { artifact, url } = parsed.data;
  // The tool output carries the summary, so there's nothing to load.
  const summary = artifact.summary?.slice(0, SLACK_ARTIFACT_SUMMARY_MAX);
  const heading =
    artifact.version > 1
      ? `*${escapeSlackText(artifact.title)}* · version ${artifact.version}`
      : `*${escapeSlackText(artifact.title)}*`;
  return {
    text: `${artifact.title}: ${url}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: summary ? `${heading}\n${escapeSlackText(summary)}` : heading,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open" },
            url,
            action_id: `notra_artifact_open:${artifact.id}`,
          },
        ],
      },
    ],
  };
}
