import { AUTH_SIGNUP_URL } from "@/constants/auth";
import {
  CONTRIBUTORS_HEADING,
  CONTRIBUTORS_HERO_SUBTITLE,
  CONTRIBUTORS_HERO_TITLE,
  CONTRIBUTORS_SUBCOPY,
  NOTRA_AI_CALLOUT_BODY,
  NOTRA_AI_CALLOUT_BODY_SUFFIX,
  NOTRA_AI_CALLOUT_CTA,
  NOTRA_AI_CALLOUT_TITLE,
  SPONSORS_CAPTION,
} from "@/constants/contributors";
import { SPONSORS } from "@/lib/sponsors/constants";
import {
  GITHUB_REPO_URL,
  fetchContributorsData,
  formatContributionCount,
  formatNotraAiPrCountLabel,
} from "@/utils/github";
import { markdownSection } from "@/utils/markdown";
import { DOCS_URL } from "@/utils/urls";

export async function buildContributorsMarkdown(): Promise<string> {
  const data = await fetchContributorsData();

  const contributorLines =
    data.contributors.length > 0
      ? data.contributors.map((contributor) => {
          const count = formatContributionCount(contributor.contributions);
          const plural = contributor.contributions === 1 ? "" : "s";
          return `- [${contributor.login}](${contributor.html_url}): ${count} contribution${plural}`;
        })
      : ["Unable to load contributors right now. Try again later."];

  const notraAiLines =
    data.notraAiPrCount > 0
      ? [
          "",
          `### ${NOTRA_AI_CALLOUT_TITLE}`,
          `${NOTRA_AI_CALLOUT_BODY} ${formatNotraAiPrCountLabel(data.notraAiPrCount)} ${NOTRA_AI_CALLOUT_BODY_SUFFIX}`,
          "",
          `[${NOTRA_AI_CALLOUT_CTA}](${DOCS_URL}/integrations/github)`,
        ]
      : [];

  return [
    `# ${CONTRIBUTORS_HERO_TITLE}`,
    "",
    CONTRIBUTORS_HERO_SUBTITLE,
    "",
    `- [Try Notra for free](${AUTH_SIGNUP_URL})`,
    `- [View on GitHub](${GITHUB_REPO_URL})`,
    "",
    markdownSection(CONTRIBUTORS_HEADING, [
      CONTRIBUTORS_SUBCOPY,
      "",
      ...contributorLines,
      ...notraAiLines,
    ]),
    SPONSORS.length > 0
      ? markdownSection("Sponsors", [
          SPONSORS_CAPTION,
          "",
          ...SPONSORS.map((sponsor) => `- [${sponsor.name}](${sponsor.url})`),
        ])
      : "",
  ].join("\n");
}
