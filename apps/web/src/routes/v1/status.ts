import { createFileRoute } from "@tanstack/react-router";

import { buildApiStatus } from "@/utils/agent-metadata";
import { jsonResponse } from "@/utils/http";

function GET() {
  return jsonResponse(buildApiStatus());
}

export const Route = createFileRoute("/v1/status")({
  server: { handlers: { GET } },
});
