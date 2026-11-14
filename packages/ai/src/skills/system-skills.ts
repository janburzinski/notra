import { getConversationalBlogPostPrompt } from "../prompts/blog_post/conversational";
import { getConversationalChangelogPrompt } from "../prompts/changelog/conversational";
import { getConversationalLinkedInPrompt } from "../prompts/linkedin/conversational";
import { getConversationalTwitterPrompt } from "../prompts/twitter/conversational";
import { UNSLOP_DESCRIPTION } from "./constants";
import { HUMANIZER_CONTENT } from "./humanizer-content";
import type { SystemSkillDefinition } from "./types";
import { UNSLOP_CONTENT } from "./unslop-content";

export function buildSystemSkills(): SystemSkillDefinition[] {
  return [
    {
      name: "changelog",
      description:
        "Write a changelog entry from the pull requests, commits, releases and Linear issues in a lookback window. Covers only changes readers can see, gives the biggest ones their own sections, then Also new and Fixes, and links to docs pages instead of private pull requests.",
      content: getConversationalChangelogPrompt(),
    },
    {
      name: "blog-post",
      description:
        "Write a long-form blog post from GitHub and Linear data. Produces narrative prose with structure and voice, not a bullet-list changelog.",
      content: getConversationalBlogPostPrompt(),
    },
    {
      name: "twitter",
      description:
        "Compose a Twitter/X post from recent development activity. Short-form, attention-grabbing, with the brand's voice.",
      content: getConversationalTwitterPrompt(),
    },
    {
      name: "linkedin",
      description:
        "Compose a LinkedIn post from recent development activity. Professional tone, medium-form, optimized for the LinkedIn feed.",
      content: getConversationalLinkedInPrompt(),
    },
    {
      name: "humanizer",
      description:
        "Remove signs of AI-generated writing from text. Use as a sub-skill from other skills to humanize a near-final draft before publishing.",
      content: HUMANIZER_CONTENT.trim(),
    },
    {
      name: "unslop",
      description: UNSLOP_DESCRIPTION,
      content: UNSLOP_CONTENT,
    },
  ];
}
