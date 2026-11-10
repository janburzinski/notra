import type {
  GeoCompetitor,
  GeoCompetitorShareResponse,
} from "@notra/geo-core/types/geo";

import type { TrafficEmbedShareOfVoiceRow } from "@/types/traffic-embed";
import { buildShareOfVoiceRows } from "@/utils/geo-charts";
import { scopeCompetitorShare } from "@/utils/geo-competitor-scope";
import {
  buildShareOfVoiceMentionSparklines,
  isOwnBrandName,
  shareOfVoiceRivalIndex,
  shareOfVoiceSliceColor,
} from "@/utils/geo-competitors";

/**
 * The rows the dashboard's share-of-voice table shows, built on the server
 * so the embed only receives the top brands and their numbers. The "other
 * brands" row has no name; the page labels it in the visitor's language.
 */
export function trafficEmbedShareOfVoiceRows({
  share,
  competitors,
  settings,
}: {
  share: Pick<GeoCompetitorShareResponse, "points" | "timeseries">;
  competitors: readonly GeoCompetitor[];
  settings: {
    companyName: string;
    aliases: readonly string[];
    engines: readonly string[];
    ignoredCompetitors: readonly string[];
  } | null;
}): TrafficEmbedShareOfVoiceRow[] {
  const companyName = settings?.companyName ?? null;
  const aliases = settings?.aliases ?? [];
  const scoped = scopeCompetitorShare({
    points: share.points,
    timeseries: share.timeseries,
    competitors,
    companyName,
    aliases,
    engines: settings?.engines,
    ignoredCompetitors: settings?.ignoredCompetitors,
  });
  const rows = buildShareOfVoiceRows(scoped.points, {
    competitors,
    companyName,
    aliases,
  });
  const sparklines = buildShareOfVoiceMentionSparklines(
    scoped.timeseries,
    rows,
    competitors
  );
  const ownBrand = { companyName, aliases };
  return rows.map((row) => ({
    ...row,
    brand: row.kind === "aggregate" ? "" : row.brand,
    own:
      row.kind === "brand" && isOwnBrandName(row.brand, companyName, aliases),
    color: shareOfVoiceSliceColor(
      row,
      shareOfVoiceRivalIndex(rows, row.brand, ownBrand),
      competitors,
      ownBrand
    ),
    mentionTrend: sparklines.get(row.id) ?? [],
  }));
}
