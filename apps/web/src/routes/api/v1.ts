import { createFileRoute } from "@tanstack/react-router";

import { buildApiDiscovery } from "@/utils/agent-metadata";
import { jsonResponse } from "@/utils/http";

function GET() {
  return jsonResponse(buildApiDiscovery());
}

export const Route = createFileRoute("/api/v1")({
  server: { handlers: { GET } },
});
