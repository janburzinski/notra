import { createFileRoute } from "@tanstack/react-router";

import { buildLlmsText } from "@/utils/llms";
import { textResponse } from "@/utils/markdown";

function GET() {
  return textResponse(buildLlmsText());
}

export const Route = createFileRoute("/llms.txt")({
  server: { handlers: { GET } },
});
