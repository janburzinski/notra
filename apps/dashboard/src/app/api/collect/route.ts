import { handleWebCollectRequest } from "@notra/geo-core/ingest/handler";

import { afterResponse } from "@/lib/framework/after-response";

export function POST(request: Request): Promise<Response> {
  return handleWebCollectRequest(request, afterResponse);
}

export { webCollectPreflightResponse as OPTIONS } from "@notra/geo-core/ingest/response";
