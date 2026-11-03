import { joinMountPath } from "@notra/sites-core/utils/mounts";
import { Effect, Option } from "effect";

import { serveFile } from "../serve-file";
import type { ManifestRouteContext } from "../types/routes";

export const htmlNotFoundRoute = Effect.fn("Sites.route.htmlNotFound")(
  function* ({ notFoundArea, loaded, fileParams }: ManifestRouteContext) {
    const notFound = notFoundArea
      ? loaded.files.get(joinMountPath(notFoundArea.mount, "404.html"))
      : undefined;
    if (!notFound) {
      return Option.none<Response>();
    }
    const response = yield* Effect.promise(() =>
      serveFile({
        ...fileParams,
        file: notFound,
        status: 404,
        extraHeaders: { Vary: "Accept" },
      })
    );
    return Option.some(response);
  }
);
