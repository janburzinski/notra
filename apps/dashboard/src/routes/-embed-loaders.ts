import { isDemoMode } from "@notra/utils/demo-mode";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import type { TrafficEmbedLoadResult } from "@/types/traffic-embed";
import type { UiRouteInput } from "@/types/ui-route";
import {
  isTrafficEmbedId,
  isTrafficEmbedPath,
  trafficEmbedRange,
  trafficEmbedRequestAllowed,
  trafficEmbedRequestContext,
} from "@/utils/traffic-embed";

export const loadTrafficEmbed = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(
    async ({
      data: { params, searchParams },
    }): Promise<TrafficEmbedLoadResult> => {
      const embedId = params.id ?? "";
      if (isDemoMode() || !isTrafficEmbedId(embedId)) {
        throw notFound();
      }
      // Rendering the embed page runs this with the page request; any other
      // call reaches the server function endpoint, which is held to the
      // rules for the page's own data requests.
      const request = getRequest();
      const context = trafficEmbedRequestContext(
        isTrafficEmbedPath(new URL(request.url).pathname) ? "page" : "data",
        request.url,
        request.headers
      );
      const { loadPublicTrafficEmbed } =
        await import("@/lib/geo/traffic-embeds");
      const embed = await loadPublicTrafficEmbed(
        embedId,
        trafficEmbedRange(searchParams.range),
        searchParams.charts,
        (config) => trafficEmbedRequestAllowed(context, config.allowedOrigins)
      );
      if (!embed) {
        throw notFound();
      }
      return embed === "blocked"
        ? { status: "blocked" }
        : { status: "ok", embed };
    }
  );
