import { track } from "@databuddy/sdk/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { McpPlatformPage } from "@/components/mcp/mcp-platform-page";
import { MCP_PLATFORMS } from "@/constants/mcp-platforms";
import { getMcpPlatformVariant } from "@/lib/mcp/platform-experiment";
import { DATABUDDY_EXPERIMENT_EXPOSED_EVENT } from "@/utils/databuddy";
import { buildHead } from "@/utils/head";
import { buildBreadcrumbJsonLd, serializeJsonLd } from "@/utils/jsonld";
import {
  buildMcpPlatformHowToJsonLd,
  getMcpPlatformFlagKey,
  getMcpPlatformHref,
} from "@/utils/mcp-platforms";
import {
  PAGE_SOCIAL_IMAGES,
  TWITTER_HANDLE,
  pageAlternates,
} from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const searchSchema = z.object({
  variant: z.enum(["geo", "growth", "aeo", "seo"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_site/mcp/$platform")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ preview: search.variant }),
  loader: async ({ params, deps }) => {
    const platform = MCP_PLATFORMS.find(
      (entry) => entry.id === params.platform
    );
    if (!platform) {
      throw notFound();
    }
    const variant =
      deps.preview ??
      (await getMcpPlatformVariant({
        data: { flagKey: getMcpPlatformFlagKey(platform.id) },
      }));
    return { platform, variant, preview: Boolean(deps.preview) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return buildHead({ title: "Page not found" });
    }
    const { platform } = loaderData;
    const title = `Notra MCP for ${platform.name}`;
    const description = `Connect Notra to ${platform.name} over MCP so it can track what AI assistants say about you, find the prompts you're missing and write the fix.`;
    const url = `${SITE_URL}${getMcpPlatformHref(platform.id)}`;
    return buildHead({
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
    });
  },
  component: McpPlatformRoute,
});

function McpPlatformRoute() {
  const { platform, variant, preview } = Route.useLoaderData();

  useEffect(() => {
    if (preview) {
      return;
    }
    track(DATABUDDY_EXPERIMENT_EXPOSED_EVENT, {
      flag_key: getMcpPlatformFlagKey(platform.id),
      variant,
    });
  }, [platform.id, preview, variant]);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "MCP Server", url: `${SITE_URL}/mcp` },
    {
      name: platform.name,
      url: `${SITE_URL}${getMcpPlatformHref(platform.id)}`,
    },
  ]);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildMcpPlatformHowToJsonLd(platform)),
        }}
        type="application/ld+json"
      />
      <McpPlatformPage platform={platform} variant={variant} />
    </>
  );
}
