import * as z from "zod";

import {
  AUTOPILOT_BRIEF_ARTIFACT_HEADINGS,
  AUTOPILOT_BRIEF_MAX_SECTIONS,
} from "@/constants/autopilot-brief";

const heading = (key: keyof typeof AUTOPILOT_BRIEF_ARTIFACT_HEADINGS) =>
  z
    .string()
    .describe(
      `"${AUTOPILOT_BRIEF_ARTIFACT_HEADINGS[key]}" in the brief's language.`
    );

/** What the model writes for a daily brief page; lengths are clamped after. */
export const autopilotBriefDraftSchema = z.object({
  headline: z
    .string()
    .describe(
      "A short title, 3 to 7 words and under 50 characters: what matters most today."
    ),
  summary: z.string().describe("One or two plain sentences."),
  lead: z
    .object({
      findingId: z.string().describe("Id of a pending item from the input."),
      why: z.string().describe("One sentence: why decide this one today."),
    })
    .nullable(),
  sections: z
    .array(
      z.object({
        title: z.string().describe("Two to five words."),
        body: z
          .string()
          .describe(
            "Two to four plain sentences. Paragraphs separated by a blank line."
          ),
        findingIds: z
          .array(z.string())
          .describe("Ids of the items this section is about, from the input."),
      })
    )
    .max(AUTOPILOT_BRIEF_MAX_SECTIONS),
  headings: z
    .object({
      waiting: heading("waiting"),
      alsoWaiting: heading("alsoWaiting"),
      merged: heading("merged"),
      worthKnowing: heading("worthKnowing"),
    })
    .describe("Fixed labels for the page, translated; short, sentence case."),
});
