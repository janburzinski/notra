import type { ByteRange } from "../types/serving";

const WEAK_PREFIX = "W/";
const SINGLE_BYTE_RANGE = /^bytes=(\d*)-(\d*)$/;

function opaqueTag(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith(WEAK_PREFIX)
    ? trimmed.slice(WEAK_PREFIX.length)
    : trimmed;
}

/**
 * If-None-Match uses the weak comparison (RFC 9110 13.1.2): `W/` is ignored,
 * the header may list several tags, and `*` matches any current file.
 * Cloudflare turns the strong ETag into `W/"…"` when it compresses a response,
 * so browsers revalidate with the weak form.
 */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) {
    return false;
  }
  if (header.trim() === "*") {
    return true;
  }
  const wanted = opaqueTag(etag);
  return header.split(",").some((tag) => opaqueTag(tag) === wanted);
}

/**
 * Resolves a single `Range: bytes=…` against a file size. Returns null when
 * the range should be ignored (absent, malformed or multi-range, which RFC
 * 9110 lets a server answer with the full 200), and "unsatisfiable" for 416.
 */
export function byteRange(
  header: string | null,
  size: number
): ByteRange | "unsatisfiable" | null {
  const match = header?.trim().match(SINGLE_BYTE_RANGE);
  if (!match || size === 0) {
    return null;
  }
  const [, first, last] = match;
  if (first === "" && last === "") {
    return null;
  }
  if (first === "") {
    const suffix = Number(last);
    return suffix === 0
      ? "unsatisfiable"
      : { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(first);
  if (start >= size) {
    return "unsatisfiable";
  }
  const end = last === "" ? size - 1 : Number(last);
  if (end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}
