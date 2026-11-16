import type { PrerenderedPage } from "@usenotra/agentside";
import { llmsFullTxt, llmsTxt } from "@usenotra/agentside/build";

import { changelog } from "@/../.source/server";
import { COMPARE_COMPETITORS } from "@/constants/compare/competitors";
import { LEGAL_PAGES } from "@/constants/markdown-twins";
import { MCP_USE_CASES } from "@/constants/mcp-use-cases";
import { STATE_OF_AI_SEARCH_PATH } from "@/constants/state-of-ai-search";
import { twins } from "@/lib/markdown/twins";
import { NOTRA_CAPABILITIES } from "@/utils/agent-metadata";
import { getCompareHref } from "@/utils/compare";
import { readMarkdownMeta } from "@/utils/markdown";
import { listMarkdownPaths } from "@/utils/markdown-twins";
import { SITE_DESCRIPTION } from "@/utils/metadata";
import { getShowcaseEntrySlug } from "@/utils/showcase";
import { DOCS_URL, MCP_URL, SITE_URL } from "@/utils/urls";

function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

const PAGE_DESCRIPTIONS: Record<string, string> = {
  "/": "Landing page overview",
  "/features": "Product capabilities and publishing workflows",
  "/pricing":
    "Plans, feature comparison and a step-by-step guide for estimating AI answers and linking a prefilled calculator",
  "/compare":
    "Comparisons of Notra with Profound, Peec AI, AthenaHQ, Scrunch and other GEO tools",
  "/showcase": "Changelogs Notra wrote for open source projects",
  ...Object.fromEntries(
    MCP_USE_CASES.map((useCase) => [
      `/mcp/use-cases/${useCase.slug}`,
      useCase.tagline,
    ])
  ),
  ...Object.fromEntries(
    changelog.map((entry) => [
      `/showcase/${entry.info.path.split("/")[0]}/${getShowcaseEntrySlug(entry.info.path)}`,
      `${entry.date} - ${entry.description}`,
    ])
  ),
};

const LLMS_SECTIONS: Record<string, string> = {
  "/features": "Features",
  "/mcp": "MCP",
  "/integrations": "Integrations",
  [STATE_OF_AI_SEARCH_PATH]: "State of AI Search",
  "/showcase": "Example Company Changelogs",
  "/compare": "Comparisons",
  ...Object.fromEntries(
    COMPARE_COMPETITORS.map((competitor) => [
      getCompareHref(competitor),
      "Comparisons",
    ])
  ),
  ...Object.fromEntries(LEGAL_PAGES.map((page) => [page.pattern, "Legal"])),
};

const LLMS_ORDER = ["/", "/features", "/pricing", "/compare", "/showcase"];

const AGENT_RESOURCE_LINKS = [
  ["Blog", "/blog/llms.txt", "Index of Notra blog posts"],
  ["Changelog", "/changelog/llms.txt", "Index of Notra product updates"],
  [
    "Developer Resources",
    "/developers/llms.txt",
    "Scoped agent and API integration resources",
  ],
  ["API Resources", "/api/llms.txt", "OpenAPI, auth and MCP"],
  [
    "Agent Onboarding",
    "/onboard.md",
    "Steps for an agent to connect itself to Notra",
  ],
  ["Agent Auth", "/auth.md", "Credential discovery and usage"],
  ["Agent Feedback", "/feedback.md", "Where agents send feedback"],
  [
    "Agent Discovery",
    "/.well-known/agent.json",
    "Machine-readable product capabilities",
  ],
  [
    "API Catalog",
    "/.well-known/api-catalog",
    "RFC 9727 linkset for API descriptions",
  ],
  [
    "Integration Surfaces",
    "/.well-known/integrations.json",
    "integrations.sh manifest of API, MCP and CLI surfaces with credentials",
  ],
].map(([title, path, description]) => ({
  title: title ?? "",
  url: absoluteUrl(path ?? ""),
  description,
}));

export function buildDeveloperLlmsText() {
  return `# Notra Developer Resources

Use Notra developer resources when integrating AI agents, SDKs, MCP clients or API automation with Notra.

## Start Here

- API quickstart: [${SITE_URL}/api/llms.txt](${SITE_URL}/api/llms.txt)
- Agent onboarding: [${SITE_URL}/onboard.md](${SITE_URL}/onboard.md)
- Auth guide: [${SITE_URL}/auth.md](${SITE_URL}/auth.md)
- API catalog: [${SITE_URL}/.well-known/api-catalog](${SITE_URL}/.well-known/api-catalog)
- Integration surfaces: [${SITE_URL}/.well-known/integrations.json](${SITE_URL}/.well-known/integrations.json)
- Agent discovery: [${SITE_URL}/.well-known/agent.json](${SITE_URL}/.well-known/agent.json)
- Documentation: [${DOCS_URL}](${DOCS_URL})

## Agent Integrations

- MCP endpoint: \`${MCP_URL}\`
- WebMCP discovery: [${SITE_URL}/.well-known/mcp](${SITE_URL}/.well-known/mcp)
- NLWeb ask endpoint: \`POST ${SITE_URL}/ask\`
`;
}

async function loadMarkdownPages() {
  const pages = await Promise.all(
    listMarkdownPaths().map(async (path): Promise<PrerenderedPage | null> => {
      const response = await twins.serve(
        new Request(absoluteUrl(path === "/" ? "/index.md" : `${path}.md`)),
        path
      );
      if (!response.ok) {
        return null;
      }
      const markdown = await response.text();
      const meta = readMarkdownMeta(markdown);
      return {
        path,
        markdown,
        title: meta.title,
        description: PAGE_DESCRIPTIONS[path] ?? meta.description,
      };
    })
  );
  return pages.filter((page) => page !== null);
}

export async function buildLlmsText() {
  const index = llmsTxt(await loadMarkdownPages(), {
    title: "Notra",
    description: SITE_DESCRIPTION,
    siteUrl: SITE_URL,
    sections: LLMS_SECTIONS,
    order: LLMS_ORDER,
    links: { "Agent Resources": AGENT_RESOURCE_LINKS },
  });

  return [
    index,
    "## When to use Notra",
    "",
    "Use Notra when a user or team wants to get recommended by AI engines: track how often ChatGPT, Claude, Gemini and Perplexity mention their brand for buyer prompts, attribute AI agent traffic on their site, find content gaps for the questions they lose and write the articles, changelogs, launch posts and social updates that close those gaps in a saved brand voice.",
    "",
    "Reach for Notra when the user asks things like:",
    "",
    '- "Does ChatGPT recommend us for <category>?" or "Who shows up instead of us?": list projects, then read visibility and share of voice for their tracked prompts',
    '- "Which AI crawlers and agents visit our site?": read AI traffic for the project',
    '- "What should we write to show up in AI answers?": read content gaps and create a brief or article for the prompts they lose',
    '- "Turn this week\'s merged PRs into a changelog or launch post": generate a post in their saved brand voice',
    "",
    "Do not use Notra for classic keyword rank tracking, paid ads or general web analytics.",
    "",
    "## How agents should call Notra",
    "",
    `- MCP (preferred for assistants): connect to ${MCP_URL} with OAuth 2.0. Authorization server metadata is at ${absoluteUrl("/.well-known/oauth-authorization-server")}`,
    "- REST: use https://api.usenotra.com/openapi.json with a scoped bearer API key or OAuth token. Read /auth.md before requesting credentials",
    "- Try it without an account: https://demo.usenotra.com hands out a free sandbox key for https://demo-api.usenotra.com with sample data",
    `- Versioning: stable operations live under /v1, breaking changes ship under a new major path and deprecations send Deprecation and Sunset headers. Policy: ${DOCS_URL}/api/versioning`,
    "- Errors: preserve the backward-compatible error string and follow any sibling recovery guidance before retrying. On 429, wait for Retry-After",
    "",
    "## Capabilities",
    "",
    ...NOTRA_CAPABILITIES.map((capability) => `- ${capability}`),
    "",
    `Full content: ${absoluteUrl("/llms-full.txt")}`,
    "",
  ].join("\n");
}

export async function buildLlmsFullText() {
  return [
    "# Notra",
    "",
    `Source index: ${absoluteUrl("/llms.txt")}`,
    `Blog posts: ${absoluteUrl("/blog/llms.txt")}`,
    `Changelog entries: ${absoluteUrl("/changelog/llms.txt")}`,
    "",
    "---",
    "",
    llmsFullTxt(await loadMarkdownPages(), { siteUrl: SITE_URL }),
  ].join("\n");
}
