import { createFileRoute } from "@tanstack/react-router";

import { OAUTH_ISSUER_ORIGIN } from "@/constants/proxy";
import { markdownResponse } from "@/utils/http";
import { demoteMarkdownHeadings } from "@/utils/markdown";

function authMd(signup: string) {
  return `# Notra Agent Authentication

Notra exposes an authenticated API and MCP server for agents that track AI visibility, manage GEO projects and prompts, analyze competitors and AI traffic and create content in a saved brand voice. Use this guide to discover the supported auth metadata, request an OAuth or API-key credential and recover from common errors.

## Discover

Start at \`/.well-known/agent.json\`, \`/.well-known/agent-card.json\` and \`/.well-known/api-catalog\`. The API resource server is \`https://api.usenotra.com\`, and its protected resource metadata is published at \`https://api.usenotra.com/.well-known/oauth-protected-resource\`. The MCP resource server is \`https://mcp.usenotra.com\`, and its protected resource metadata is published at \`https://mcp.usenotra.com/.well-known/oauth-protected-resource\`. Unauthenticated API and MCP requests return a \`WWW-Authenticate\` header with a \`resource_metadata\` url.

## Pick a method

Agents acting for a person who has no credential yet should use agent registration below. OAuth-capable clients should follow the authorization server advertised by the protected resource metadata. The production authorization server is \`https://oauth.usenotra.com\`, with standard endpoints at \`/oauth2/authorize\`, \`/oauth2/token\`, \`/oauth2/register\` and \`/oauth2/revoke\` and signing keys at \`/oauth2/jwks\`. Manual clients can use API keys created in the Notra dashboard. To try the API without an account, use the demo sandbox.

${signup}

## Try the demo sandbox

The demo sandbox is a disposable workspace with sample data. It never touches real accounts.

1. Call \`POST https://oauth.usenotra.com/agent/identity\` with \`{"type": "anonymous"}\` and exchange \`identity.assertion\` at \`/oauth2/token\` as in the exchange step above.
2. Call \`POST https://demo.usenotra.com/api/demo/agent\` with \`Authorization: Bearer <access_token>\`. The response contains \`apiKey\`, \`apiBaseUrl\`, \`organizationId\` and \`expiresAt\`.
3. Use \`apiKey\` as the bearer credential against \`apiBaseUrl\` only. Production rejects it. Sandboxes expire after a few hours and idle ones can be reclaimed sooner, so call the endpoint again if the key stops working. A \`503\` means the demo is busy, so respect \`Retry-After\`.

## Register an OAuth client

Call \`POST https://oauth.usenotra.com/oauth2/register\` for dynamic OAuth client registration, or identify with a Client ID Metadata Document if your client supports it. Request \`openid\` and include \`offline_access\` for refresh tokens. The consent screen lets the user select a workspace and one access level: Read only, Write only or Full access across all resources, including GEO. These signed choices are enforced as granular API permissions; missing choices grant no access. GEO tools also require a plan that includes GEO.

## Authorize

Use the authorization code flow with PKCE (\`S256\`). Headless clients without a redirect target can use the device authorization grant at \`https://oauth.usenotra.com/oauth2/device_authorization\`, then poll \`/oauth2/token\` with the returned device code while the user approves in a browser.

## Use the credential

Send the credential as \`Authorization: Bearer <TOKEN>\`. For MCP clients that support OAuth discovery, start at \`https://mcp.usenotra.com/.well-known/oauth-protected-resource\`; for manual clients, use a Notra API key as the bearer credential when connecting to \`https://mcp.usenotra.com/mcp\`.

## Errors

401 responses include \`WWW-Authenticate: Bearer resource_metadata="https://api.usenotra.com/.well-known/oauth-protected-resource"\`. Error bodies keep the backward-compatible \`error\` string and may include sibling \`code\` and \`recovery\` fields. If a request is rate limited, respect \`Retry-After\`.

## Revocation

Call \`POST https://oauth.usenotra.com/oauth2/revoke\` for OAuth tokens, or revoke API keys in the Notra dashboard. Agents should discard revoked credentials immediately and repeat discovery before requesting a replacement.
`;
}

const AGENT_SIGNUP_URL = `${OAUTH_ISSUER_ORIGIN}/agent/auth.md`;

const AGENT_SIGNUP_INTRO = `## Sign up as an agent

Agent registration lets you create or connect a Notra account for your user without a browser form. After the claim, you act in the workspace named on the claim page, with the permissions your user has. Use the access token as the bearer credential for \`https://api.usenotra.com\` and \`https://mcp.usenotra.com/mcp\`. Never invent the claim code or ask the user for a password.`;

async function agentSignup() {
  const response = await fetch(AGENT_SIGNUP_URL, {
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);
  if (!response?.ok) {
    return `${AGENT_SIGNUP_INTRO}\n\nFollow the steps at ${AGENT_SIGNUP_URL}.`;
  }
  const steps = (await response.text()).replace(/^# .*\n+/, "");
  return `${AGENT_SIGNUP_INTRO}\n\n${demoteMarkdownHeadings(steps).trim()}`;
}

async function GET() {
  return markdownResponse(authMd(await agentSignup()));
}

export const Route = createFileRoute("/auth.md")({
  server: { handlers: { GET } },
});
