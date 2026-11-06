import { createFileRoute } from "@tanstack/react-router";

import { DATA_CACHE_CONTROL } from "@/constants/data";
import { loadDataSnapshot } from "@/lib/data/snapshot";

async function GET() {
  const snapshot = await loadDataSnapshot();
  if (!snapshot) {
    return Response.json(
      { error: "AI traffic data is not available right now" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": DATA_CACHE_CONTROL,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const Route = createFileRoute("/_site/data/index.json")({
  server: { handlers: { GET } },
});
