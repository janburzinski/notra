import { createFileRoute } from "@tanstack/react-router";

import { McpHero } from "@/components/mcp/mcp-hero";
import { McpTerminalDemo } from "@/components/mcp/mcp-terminal-demo";
import { McpToolsGrid } from "@/components/mcp/mcp-tools-grid";
import { McpUseCasesCallout } from "@/components/mcp/mcp-use-cases-callout";
import { MCP_HERO_SUBHEAD } from "@/constants/mcp";
import { getMcpTools } from "@/lib/mcp/functions";
import type { Metadata } from "@/types/metadata";
import { buildHead } from "@/utils/head";
import { buildBreadcrumbJsonLd, serializeJsonLd } from "@/utils/jsonld";
import {
  PAGE_SOCIAL_IMAGES,
  TWITTER_HANDLE,
  pageAlternates,
} from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const title = "Notra MCP Server";
const description =
  "Connect your agent to Notra over MCP to track what ChatGPT, Claude and Gemini say about you, find the prompts you're missing and write the content that fixes it.";
const url = `${SITE_URL}/mcp`;

const metadata: Metadata = {
  title,
  description,
  alternates: pageAlternates(url),
  openGraph: {
    title,
    description,
    url,
    type: "website",
    siteName: "Notra",
    images: [PAGE_SOCIAL_IMAGES.mcpServer],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [PAGE_SOCIAL_IMAGES.mcpServer.url],
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
  },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Home", url: SITE_URL },
  { name: "MCP Server", url },
]);

export const Route = createFileRoute("/_site/mcp/")({
  loader: () => getMcpTools(),
  head: () => buildHead(metadata),
  component: McpPage,
});

function McpPage() {
  const tools = Route.useLoaderData();

  return (
    <div className="flex w-full flex-col items-center gap-8 pb-14 antialiased [font-synthesis:none]">
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <McpHero subhead={MCP_HERO_SUBHEAD} />
      <div className="flex w-[min(100%-3rem,62.5rem)] flex-col gap-16 pt-8">
        <McpTerminalDemo toolCount={tools.length} />
        <McpToolsGrid tools={tools} />
        <McpUseCasesCallout />
      </div>
    </div>
  );
}
