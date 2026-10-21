import {
  Book02Icon,
  Calendar03Icon,
  FileEditIcon,
  GitBranchIcon,
  GitCompareIcon,
  HelpCircleIcon,
  Image01Icon,
  Link04Icon,
  RefreshIcon,
  Robot01Icon,
  Search01Icon,
  Tag01Icon,
  TranslateIcon,
  Unlink02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

export type VariantCategory = "site" | "content" | "releases";
export type VariantOutput = "pull_request" | "post";
export type VariantTrigger = "run" | "merge" | "weekly" | "drop";

export interface VariantTemplate {
  id: string;
  name: string;
  description: string;
  /** What the agent is told, shown when a template is opened or remixed. */
  instructions: string;
  category: VariantCategory;
  icon: IconSvgElement;
  source: string;
  output: VariantOutput;
  trigger: VariantTrigger;
  /** Set for the three built-in jobs that exist today. */
  kind?: AutopilotAutomationKind;
  /** Custom ones saved in this workspace. */
  custom?: boolean;
  author?: string;
  /** Path scope a custom template was saved with. */
  paths?: string;
}

export const VARIANT_CATEGORIES: Record<VariantCategory, string> = {
  site: "Site fixes",
  content: "Self-updating content",
  releases: "Releases and docs",
};

/** Same six-card row as the Automations page; the rest live behind "More". */
export const FEATURED_VARIANT_TEMPLATE_IDS = [
  "readiness",
  "keywords",
  "commits",
  "broken-links",
  "refresh-posts",
  "docs-drift",
];

export const VARIANT_TONES: Record<
  string,
  "destructive" | "info" | "success" | "warning"
> = {
  readiness: "info",
  "broken-links": "destructive",
  "faq-schema": "info",
  "meta-descriptions": "warning",
  "alt-text": "info",
  keywords: "warning",
  "refresh-posts": "success",
  "comparison-pages": "destructive",
  "internal-links": "info",
  translate: "success",
  commits: "success",
  changelog: "info",
  "docs-drift": "warning",
  "monthly-recap": "info",
};

export const VARIANT_OUTPUTS: Record<VariantOutput, string> = {
  pull_request: "Pull request",
  post: "Draft post",
};

export const VARIANT_TRIGGERS: Record<VariantTrigger, string> = {
  run: "Daily run",
  merge: "GitHub merge",
  weekly: "Weekly",
  drop: "GEO scan",
};

export const VARIANT_TEMPLATES: VariantTemplate[] = [
  {
    id: "readiness",
    kind: "readiness",
    name: "Fix agent readiness",
    description:
      "Rescans your site and opens a pull request for llms.txt, AI crawler rules and structured data.",
    instructions:
      "Run the Agent Readiness scan. For every failing check that can be fixed in the repository, open one pull request with the fix.",
    category: "site",
    icon: Robot01Icon,
    source: "Agent Readiness scan",
    output: "pull_request",
    trigger: "run",
  },
  {
    id: "broken-links",
    name: "Fix broken links",
    description:
      "Crawls your site, finds links that 404 or redirect and opens one pull request that fixes them.",
    instructions:
      "Crawl the published site. Collect links that return 404 or redirect more than once. Replace each with its final URL, or remove it if the target is gone.",
    category: "site",
    icon: Unlink02Icon,
    source: "Your site",
    output: "pull_request",
    trigger: "weekly",
  },
  {
    id: "faq-schema",
    name: "Add FAQ schema",
    description:
      "Adds FAQPage structured data to pages AI answers already cite, so engines can quote them cleanly.",
    instructions:
      "Find pages cited in AI answers that contain question-and-answer sections without FAQPage JSON-LD. Add the schema from the existing copy without changing the text.",
    category: "site",
    icon: HelpCircleIcon,
    source: "Cited pages",
    output: "pull_request",
    trigger: "weekly",
  },
  {
    id: "meta-descriptions",
    name: "Write missing meta descriptions",
    description:
      "Fills in titles and descriptions that are missing, duplicated or cut off in search results.",
    instructions:
      "List pages with a missing, duplicate or over 160 character meta description. Write one per page in the brand voice from the page's own content.",
    category: "site",
    icon: Tag01Icon,
    source: "Your site",
    output: "pull_request",
    trigger: "weekly",
  },
  {
    id: "alt-text",
    name: "Add image alt text",
    description:
      "Describes images that have no alt text, in the markdown or components they appear in.",
    instructions:
      "Find images in content files without alt text. Describe what each image shows in one short sentence.",
    category: "site",
    icon: Image01Icon,
    source: "Content files",
    output: "pull_request",
    trigger: "weekly",
  },
  {
    id: "keywords",
    kind: "keywords",
    name: "Write for content gaps",
    description:
      "Drafts a post for prompts and searches where competitors show up and you don't.",
    instructions:
      "Pick the prompt or search with the highest volume where competitors are mentioned and you aren't. Draft a post that answers it.",
    category: "content",
    icon: Search01Icon,
    source: "Prompts and searches you lose",
    output: "post",
    trigger: "run",
  },
  {
    id: "refresh-posts",
    name: "Refresh losing posts",
    description:
      "Updates older posts that stopped being cited, with current facts, dates and examples.",
    instructions:
      "Find posts older than six months that lost citations in the last 30 days. Update outdated facts, dates and screenshots, and keep the URL.",
    category: "content",
    icon: RefreshIcon,
    source: "Posts that lost citations",
    output: "pull_request",
    trigger: "drop",
  },
  {
    id: "comparison-pages",
    name: "Answer competitor comparisons",
    description:
      'Drafts a "you vs. them" page when a competitor starts winning prompts you used to win.',
    instructions:
      "When a competitor gains share on a prompt, draft an honest comparison page between both products, sourced from both public sites.",
    category: "content",
    icon: GitCompareIcon,
    source: "Competitor gains",
    output: "post",
    trigger: "drop",
  },
  {
    id: "internal-links",
    name: "Link new posts internally",
    description:
      "When a post goes live, adds links to it from the three most related older posts.",
    instructions:
      "When a new post is merged, find the three most related existing posts and add one natural link to it in each.",
    category: "content",
    icon: Link04Icon,
    source: "New posts",
    output: "pull_request",
    trigger: "merge",
  },
  {
    id: "translate",
    name: "Translate new posts",
    description:
      "Opens a pull request with a translated copy of every new post in the languages you pick.",
    instructions:
      "When a new post is merged, translate it into German and French. Keep code blocks, links and frontmatter keys unchanged.",
    category: "content",
    icon: TranslateIcon,
    source: "New posts",
    output: "pull_request",
    trigger: "merge",
  },
  {
    id: "commits",
    kind: "commits",
    name: "Write about releases",
    description:
      "Drafts a post when you ship something worth telling users about.",
    instructions:
      "Read the pull requests merged since the last run. When one is something new users need explained, draft a post about it.",
    category: "releases",
    icon: GitBranchIcon,
    source: "Pull requests you ship",
    output: "post",
    trigger: "merge",
  },
  {
    id: "changelog",
    name: "Keep the changelog current",
    description:
      "Adds an entry to your changelog file for every user-facing pull request that ships.",
    instructions:
      "For each merged pull request users would notice, add a dated entry to CHANGELOG.md in the existing format.",
    category: "releases",
    icon: FileEditIcon,
    source: "Pull requests you ship",
    output: "pull_request",
    trigger: "merge",
  },
  {
    id: "docs-drift",
    name: "Update docs when the API changes",
    description:
      "Opens a docs pull request when a merged change touches endpoints, options or CLI flags.",
    instructions:
      "When a merged pull request changes API routes, config options or CLI flags, update the matching pages in docs/.",
    category: "releases",
    icon: Book02Icon,
    source: "Pull requests you ship",
    output: "pull_request",
    trigger: "merge",
  },
  {
    id: "monthly-recap",
    name: "Monthly product recap",
    description:
      "Drafts one post on the first of the month with everything that shipped.",
    instructions:
      "On the first run of each month, draft a recap post of everything user-facing that shipped the month before, grouped by area.",
    category: "releases",
    icon: Calendar03Icon,
    source: "Pull requests you ship",
    output: "post",
    trigger: "weekly",
  },
];

/** What a workspace would have saved after a few weeks. */
export const VARIANT_CUSTOM_TEMPLATES: VariantTemplate[] = [
  {
    id: "custom-pricing",
    custom: true,
    author: "Dominik",
    name: "Keep pricing page in sync",
    description:
      "Updates the pricing page whenever plan limits change in the billing config.",
    instructions:
      "When packages/billing/plans.ts changes, update the limits table on apps/web/pricing to match. Don't touch copy outside the table.",
    category: "site",
    icon: Tag01Icon,
    source: "Pull requests you ship",
    output: "pull_request",
    trigger: "merge",
  },
];
