import type { McpClient } from "@/types/mcp";
import type { McpPlatform, McpPlatformId } from "@/types/mcp-platforms";
import { MCP_URL, SITE_URL } from "@/utils/urls";

export function getMcpPlatformFlagKey(id: McpPlatformId) {
  return `mcp-platform-${id}`;
}

export function getMcpPlatformHref(id: McpPlatformId) {
  return `/mcp/${id}`;
}

export function mcpPlatformScreenshot(
  id: McpPlatformId,
  step: number,
  alt: string
) {
  return {
    light: `/mcp/setup/${id}-${step}-light.webp`,
    dark: `/mcp/setup/${id}-${step}-dark.webp`,
    alt,
  };
}

export function getMcpPlatformCommands(platform: McpPlatform): McpClient[] {
  const url: McpClient = {
    id: "server-url",
    label: "Server URL",
    copyLabel: "Copy server URL",
    invertInDark: false,
    command: MCP_URL,
  };
  const commands = platform.commands ?? [];
  return commands[0]?.id === platform.id
    ? [...commands, url]
    : [url, ...commands];
}

export function buildMcpPlatformHowToJsonLd(platform: McpPlatform) {
  const url = `${SITE_URL}${getMcpPlatformHref(platform.id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to connect Notra to ${platform.name}`,
    description: platform.description,
    totalTime: "PT2M",
    supply: [{ "@type": "HowToSupply", name: platform.requirements }],
    step: platform.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.code ? `${step.body} ${step.code}` : step.body,
      url: `${url}#step-${index + 1}`,
      ...(step.screenshot
        ? { image: `${SITE_URL}${step.screenshot.light}` }
        : {}),
    })),
  };
}
