import { createHash } from "node:crypto";

import {
  ANALYTICS_IMPORT_CSV_HASH_LENGTH,
  ANALYTICS_IMPORT_CSV_REF,
} from "@/constants/analytics-imports";

/**
 * Passes an export through while hashing it. The hash is the export's
 * source ref, so two different exports of one domain are two sources and
 * the same export uploaded twice is recognised as one.
 */
export function hashExport(chunks: AsyncIterable<Uint8Array>) {
  const hash = createHash("sha256");
  async function* hashed() {
    for await (const chunk of chunks) {
      hash.update(chunk);
      yield chunk;
    }
  }
  return {
    chunks: hashed(),
    /** Call once the export was read to the end. */
    ref: () =>
      `${ANALYTICS_IMPORT_CSV_REF}:${hash.digest("hex").slice(0, ANALYTICS_IMPORT_CSV_HASH_LENGTH)}`,
  };
}
