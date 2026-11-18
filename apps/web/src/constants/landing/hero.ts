import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { Slack } from "@notra/ui/components/ui/svgs/slack";

import type { HeroCycleWord, HeroVariant } from "@/types/landing/hero";

export const HERO_HEADLINE_CYCLE: HeroCycleWord[] = [
  { text: "ChatGPT", engine: "chatgpt" },
  { text: "Claude", engine: "claude" },
  { text: "Perplexity", engine: "perplexity" },
  { text: "Gemini", engine: "gemini" },
  { text: "Grok", engine: "grok" },
  { text: "Kimi", engine: "kimi" },
];

export const HERO_HEADLINE_CYCLE_MOBILE = HERO_HEADLINE_CYCLE.filter(
  (word) => word.text.length <= 7
);

export const HERO_HEADLINE_CYCLE_MS = 2600;

const HERO_BOOK_A_CALL_HREF = "/contact";

const HERO_CLAUDE_CONNECTOR_HREF = "https://claude.ai/directory/notra";

const HERO_CHATGPT_APP_HREF =
  "https://chatgpt.com/plugins/plugin_asdk_app_6ad054bf08248191a320ed1334e3ffde";

export const HERO_EXPERIMENT_FLAG = "landing-hero";

export const HERO_CONTROL_VARIANT = "control";

export const HERO_VARIANTS: Record<string, HeroVariant> = {
  [HERO_CONTROL_VARIANT]: {
    id: "control",
    cycles: true,
    secondaryHref: HERO_BOOK_A_CALL_HREF,
  },
  visibility: {
    id: "visibility",
    cycles: true,
    secondaryHref: HERO_BOOK_A_CALL_HREF,
  },
  slack: {
    id: "slack",
    brandIcon: Slack,
    cycles: true,
    secondaryHref: "/integrations/slack",
  },
  claude: {
    id: "claude",
    brandIcon: ClaudeAiIcon,
    cycles: true,
    secondaryHref: HERO_CLAUDE_CONNECTOR_HREF,
  },
  "claude-expert": {
    id: "claude-expert",
    brandIcon: ClaudeAiIcon,
    cycles: false,
    secondaryHref: HERO_CLAUDE_CONNECTOR_HREF,
  },
  chatgpt: {
    id: "chatgpt",
    brandIcon: Openai,
    brandIconClassName: "dark:fill-white",
    cycles: true,
    secondaryHref: HERO_CHATGPT_APP_HREF,
  },
  "chatgpt-expert": {
    id: "chatgpt-expert",
    brandIcon: Openai,
    brandIconClassName: "dark:fill-white",
    cycles: false,
    secondaryHref: HERO_CHATGPT_APP_HREF,
  },
};

export const HERO_SIGNUP_SOURCE = "hero";

export const HERO_TAP_PRESS_CLASSNAME =
  "motion-safe:[animation:heroTapPress_2.4s_cubic-bezier(0.32,0.72,0,1)_1.5s_2]";

export const HERO_PREVIEW_VARIANT_PARAM = "hero_variant";

export const HERO_PREVIEW_ENABLED = import.meta.env.DEV;

export const HERO_WEBSITE_PARAM = "website";

export const HERO_WEBSITE_MAX_LENGTH = 253;
