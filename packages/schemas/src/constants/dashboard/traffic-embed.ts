/**
 * Every chart an embed can show, in page order. An embed stores the ones its
 * owner made public; the page URL can only pick from those.
 */
export const TRAFFIC_EMBED_CHARTS = [
  "traffic",
  "visibility",
  "engines",
  "share-of-voice",
  "languages",
  "countries",
] as const;

export const TRAFFIC_EMBED_DEFAULT_CHARTS = [
  "traffic",
] as const satisfies readonly (typeof TRAFFIC_EMBED_CHARTS)[number][];
