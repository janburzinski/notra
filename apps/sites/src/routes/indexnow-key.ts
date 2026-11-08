import { indexNowKey } from "@notra/sites-core/utils/indexnow";
import { joinMountPath } from "@notra/sites-core/utils/mounts";
import { Effect, Option } from "effect";

import { ROBOTS_TXT_MAX_AGE_SECONDS } from "../constants/responses";
import type { ManifestRouteContext } from "../types/routes";
import { plainText } from "../utils/responses";

const KEY_FILE = /\/[0-9a-f]{64}\.txt$/;

export const indexNowKeyRoute = Effect.fnUntraced(function* ({
  path,
  area,
  resolved,
  loaded: { manifest },
}: ManifestRouteContext) {
  if (
    !KEY_FILE.test(path) ||
    resolved.isPreview ||
    manifest.target.noindex ||
    manifest.indexNow === false
  ) {
    return Option.none<Response>();
  }
  const key = yield* Effect.promise(() => indexNowKey(resolved.siteId));
  if (path !== joinMountPath(area?.mount ?? "/", `${key}.txt`)) {
    return Option.none<Response>();
  }
  return Option.some(plainText(key, ROBOTS_TXT_MAX_AGE_SECONDS));
});
