import { createHash } from "node:crypto";

import {
  MEMORY_SEGMENT_DOTS,
  MEMORY_SEGMENT_EDGE,
  MEMORY_SEGMENT_HASH_CHARS,
  MEMORY_SEGMENT_UNSAFE,
} from "../constants/memory";

function memoryPathSegment(name: string) {
  const lower = name.toLowerCase();
  const safe =
    lower
      .replace(MEMORY_SEGMENT_UNSAFE, "-")
      .replace(MEMORY_SEGMENT_DOTS, "-")
      .replace(MEMORY_SEGMENT_EDGE, "") || "unnamed";
  if (safe === lower) {
    return safe;
  }
  const hash = createHash("sha256")
    .update(lower)
    .digest("hex")
    .slice(0, MEMORY_SEGMENT_HASH_CHARS);
  return `${safe}-${hash}`;
}

export function memoryConventionsPath(owner: string, repo: string) {
  return `conventions/${memoryPathSegment(owner)}/${memoryPathSegment(repo)}.md`;
}
