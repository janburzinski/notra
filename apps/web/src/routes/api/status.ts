import { createFileRoute } from "@tanstack/react-router";

import { buildApiStatus } from "@/utils/agent-metadata";
import { jsonResponse } from "@/utils/http";

function GET() {
  return jsonResponse(buildApiStatus());
}

export const Route = createFileRoute("/api/status")({
  server: { handlers: { GET } },
});
