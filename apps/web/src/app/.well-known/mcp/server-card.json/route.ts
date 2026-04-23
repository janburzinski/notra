import { DOCS_URL, MCP_URL } from "@/utils/urls";

export function GET() {
  const body = {
    serverInfo: {
      name: "notra",
      version: "1.0.4",
    },
    transport: {
      type: "streamable-http",
      endpoint: MCP_URL,
    },
    capabilities: ["tools"],
    authentication: {
      type: "bearer",
      description: "Notra API key, created at https://app.usenotra.com",
    },
    documentation: `${DOCS_URL}/integrations/mcp`,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
