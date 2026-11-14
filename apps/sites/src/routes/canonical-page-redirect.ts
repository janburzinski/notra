import { Effect, Option } from "effect";

import { manifestRedirect } from "../responses/redirects";
import type { ManifestRouteContext } from "../types/routes";
import { canonicalPagePath } from "../utils/routing";

export const canonicalPageRedirectRoute = ({
  url,
  loaded,
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() =>
    Option.map(
      Option.fromNullishOr(canonicalPagePath(loaded.files, url.pathname)),
      (pagePath) =>
        manifestRedirect({ status: 308, location: `${pagePath}${url.search}` })
    )
  );
