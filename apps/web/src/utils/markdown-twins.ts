import type { Source } from "@usenotra/agentside";

import { changelog } from "@/../.source/server";
import { DATA_PATH } from "@/constants/data";
import { FEATURE_DETAIL_SLUGS } from "@/constants/feature-pages/paths";
import { LEGAL_PAGES } from "@/constants/markdown-twins";
import { MCP_PLATFORMS } from "@/constants/mcp-platforms";
import { MCP_USE_CASES } from "@/constants/mcp-use-cases";
import { STATE_OF_AI_SEARCH_PATH } from "@/constants/state-of-ai-search";
import { buildAgentPageMarkdown } from "@/lib/agent/markdown";
import {
  buildCompareIndexMarkdown,
  buildCompareMarkdown,
  listCompareMarkdownPages,
} from "@/lib/compare/markdown";
import { buildContributorsMarkdown } from "@/lib/contributors/markdown";
import { buildDataMarkdown } from "@/lib/data/markdown";
import { buildFeedbackMdPageMarkdown } from "@/lib/feedback-md/markdown";
import {
  buildIntegrationMarkdown,
  buildIntegrationsMarkdown,
  buildGithubIntegrationMarkdown,
  buildGranolaIntegrationMarkdown,
  buildLinearIntegrationMarkdown,
  buildSlackIntegrationMarkdown,
} from "@/lib/integrations/markdown";
import { buildMarketingAssetsMarkdown } from "@/lib/marketing-assets/markdown";
import {
  buildMcpMarkdown,
  buildMcpPlatformMarkdown,
  buildMcpUseCaseMarkdown,
  buildMcpUseCasesMarkdown,
} from "@/lib/mcp/markdown";
import {
  buildStateOfAiSearchIndexMarkdown,
  buildStateOfAiSearchReportMarkdown,
} from "@/lib/state-of-ai-search/markdown";
import { listSummaries, loadReport } from "@/lib/state-of-ai-search/reports";
import { stripFrontmatter } from "@/utils/markdown";
import { readAppMarkdownSource } from "@/utils/markdown-source";
import { getMcpPlatformHref } from "@/utils/mcp-platforms";
import {
  getShowcaseCompany,
  getShowcaseEntrySlug,
  SHOWCASE_COMPANIES,
} from "@/utils/showcase";
import {
  buildBrandMarkdown,
  buildFeaturesMarkdown,
  buildLandingMarkdown,
  buildPricingMarkdown,
} from "@/utils/site-markdown";
import { reportPath } from "@/utils/state-of-ai-search";
import { SITE_URL } from "@/utils/urls";

const STATIC_MARKDOWN_PAGES = [
  "about",
  "contact",
  "free-hat",
  "html-to-figma",
  "html-to-paper",
  "oss-program",
  "repo-star-video",
  "twitter-thread-creator",
] as const;

function absoluteUrl(pathname: string) {
  return `${SITE_URL}${pathname}`;
}

function withTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function markdownFromTitleAndBody(title: string, body: string) {
  const content = stripFrontmatter(body).trim();

  return withTrailingNewline([`# ${title}`, "", content].join("\n"));
}

function findShowcaseEntry(company: string, slug: string) {
  if (!getShowcaseCompany(company)) {
    return;
  }
  return changelog.find(
    (entry) =>
      entry.info.path.startsWith(`${company}/`) &&
      getShowcaseEntrySlug(entry.info.path) === slug
  );
}

function buildShowcaseEntryMarkdown(company: string, slug: string) {
  const entry = findShowcaseEntry(company, slug);
  if (!entry) {
    return null;
  }
  return markdownFromTitleAndBody(
    entry.title,
    `Date: ${entry.date}\n\n${stripFrontmatter(readAppMarkdownSource("changelog", entry.info.path))}`
  );
}

function buildChangelogHubMarkdown() {
  const list = [
    `- [Notra](${absoluteUrl("/changelog/index.md")})`,
    ...SHOWCASE_COMPANIES.map(
      (company) =>
        `- [${company.name}](${absoluteUrl(`/showcase/${company.slug}.md`)})`
    ),
  ].join("\n");

  return [
    "# Showcase",
    "",
    "See how Notra transforms GitHub activity into professional product updates from real open source projects.",
    "",
    "## Changelogs",
    "",
    list,
    "",
  ].join("\n");
}

function buildShowcaseCompanyMarkdown(name: string) {
  const company = getShowcaseCompany(name);

  if (!company) {
    return null;
  }

  const entries = changelog
    .filter((entry) => entry.info.path.startsWith(`${name}/`))
    .sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime()
    )
    .map(
      (entry) =>
        `- [${entry.title}](${absoluteUrl(`/showcase/${name}/${getShowcaseEntrySlug(entry.info.path)}.md`)}) (${entry.date})`
    )
    .join("\n");

  return [
    `# ${company.name} Changelog`,
    "",
    company.description,
    "",
    `Website: ${company.url}`,
    "",
    "## Entries",
    "",
    entries || "No changelog entries found.",
    "",
  ].join("\n");
}

async function buildLegalMarkdown(title: string, filename: string) {
  const source = await readAppMarkdownSource("legal", filename);
  return markdownFromTitleAndBody(title, source);
}

export function buildMarkdownRoutes(): Record<string, Source> {
  const pages: [string, Source][] = [
    ["/", () => buildLandingMarkdown()],
    ["/features", () => buildFeaturesMarkdown()],
    ["/pricing", () => buildPricingMarkdown()],
    ["/brand", () => buildBrandMarkdown()],
    ["/feedback-md", () => buildFeedbackMdPageMarkdown()],
    ["/agent", () => buildAgentPageMarkdown()],
    ["/mcp", () => buildMcpMarkdown()],
    ["/mcp/use-cases", () => buildMcpUseCasesMarkdown()],
    ...MCP_PLATFORMS.map((platform): [string, Source] => [
      getMcpPlatformHref(platform.id),
      () => buildMcpPlatformMarkdown(platform),
    ]),
    ["/compare", () => buildCompareIndexMarkdown()],
    [STATE_OF_AI_SEARCH_PATH, () => buildStateOfAiSearchIndexMarkdown()],
    [DATA_PATH, () => buildDataMarkdown()],
    ...listSummaries().map((summary): [string, Source] => [
      reportPath(summary.slug, summary.edition),
      async () => {
        const report = await loadReport(summary.slug, summary.edition);
        return report ? buildStateOfAiSearchReportMarkdown(report) : null;
      },
    ]),
    ...listCompareMarkdownPages().map((page): [string, Source] => [
      page.pattern,
      () => buildCompareMarkdown(page.slug),
    ]),
    ["/contributors", () => buildContributorsMarkdown()],
    ["/integrations", () => buildIntegrationsMarkdown()],
    ["/integrations/slack", () => buildSlackIntegrationMarkdown()],
    ["/integrations/github", () => buildGithubIntegrationMarkdown()],
    ["/integrations/linear", () => buildLinearIntegrationMarkdown()],
    ["/integrations/granola", () => buildGranolaIntegrationMarkdown()],
    ["/features/marketing/assets", () => buildMarketingAssetsMarkdown()],
    ["/showcase", () => buildChangelogHubMarkdown()],
    ...SHOWCASE_COMPANIES.map((company): [string, Source] => [
      `/showcase/${company.slug}`,
      () => buildShowcaseCompanyMarkdown(company.slug),
    ]),
    ...FEATURE_DETAIL_SLUGS.map((slug): [string, Source] => [
      `/features/${slug}`,
      () => readAppMarkdownSource("pages", "features", `${slug}.md`),
    ]),
    ...STATIC_MARKDOWN_PAGES.map((page): [string, Source] => [
      `/${page}`,
      () => readAppMarkdownSource("pages", `${page}.md`),
    ]),
    ...LEGAL_PAGES.map((page): [string, Source] => [
      page.pattern,
      () => buildLegalMarkdown(page.title, page.filename),
    ]),
    [
      "/mcp/use-cases/[slug]",
      ({ params }) => {
        const markdown = buildMcpUseCaseMarkdown(params.slug ?? "");
        return markdown === null ? null : withTrailingNewline(markdown);
      },
    ],
    [
      "/showcase/[company]/[slug]",
      ({ params }) =>
        buildShowcaseEntryMarkdown(params.company ?? "", params.slug ?? ""),
    ],
    [
      "/integrations/[id]",
      async ({ params }) => {
        const markdown = await buildIntegrationMarkdown(params.id ?? "");
        return markdown ? withTrailingNewline(markdown) : null;
      },
    ],
  ];

  return Object.fromEntries(pages);
}

export function listMarkdownPaths() {
  return [
    ...Object.keys(buildMarkdownRoutes()).filter((path) => !path.includes("[")),
    ...MCP_USE_CASES.map((useCase) => `/mcp/use-cases/${useCase.slug}`),
    ...changelog
      .filter((entry) =>
        getShowcaseCompany(entry.info.path.split("/")[0] ?? "")
      )
      .map(
        (entry) =>
          `/showcase/${entry.info.path.split("/")[0]}/${getShowcaseEntrySlug(entry.info.path)}`
      ),
  ];
}
