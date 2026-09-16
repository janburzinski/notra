import { geoSentimentCursorSchema } from "@notra/geo-core/schemas/geo-sentiment";
import type { GeoSentimentEvidenceInput } from "@notra/geo-core/types/geo-sentiment";

type SentimentCursor = NonNullable<GeoSentimentEvidenceInput["cursor"]>;

export function encodeGeoSentimentCursor(
  cursor: SentimentCursor | null
): string | null {
  return cursor
    ? Buffer.from(JSON.stringify(cursor)).toString("base64url")
    : null;
}

export function decodeGeoSentimentCursor(
  value: string | undefined
): SentimentCursor | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const cursor = geoSentimentCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : undefined;
  } catch {
    return undefined;
  }
}
