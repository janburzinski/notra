import { geoSentimentCursorSchema } from "@notra/geo-core/schemas/geo-sentiment";
import type { GeoSentimentEvidenceInput } from "@notra/geo-core/types/geo-sentiment";
import { z } from "zod";

type SentimentCursor = NonNullable<GeoSentimentEvidenceInput["cursor"]>;
type SentimentWindow = { from: string; to: string };
type ApiSentimentCursor = SentimentCursor & SentimentWindow;

const apiSentimentCursorSchema = geoSentimentCursorSchema
  .extend({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine(
    ({ from, to }) => {
      const days =
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
          86_400_000 +
        1;
      return Number.isInteger(days) && days >= 1 && days <= 366;
    },
    { message: "Cursor contains an invalid sentiment window" }
  );

export function encodeGeoSentimentCursor(
  cursor: SentimentCursor | null,
  window: SentimentWindow
): string | null {
  return cursor
    ? Buffer.from(JSON.stringify({ ...cursor, ...window })).toString(
        "base64url"
      )
    : null;
}

export function decodeGeoSentimentCursor(
  value: string | undefined
): ApiSentimentCursor | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const cursor = apiSentimentCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : undefined;
  } catch {
    return undefined;
  }
}
