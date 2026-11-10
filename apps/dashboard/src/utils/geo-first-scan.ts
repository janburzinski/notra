import type {
  GeoCheckScanCompetitorRow,
  GeoCheckScanPromptRow,
} from "@notra/db/types/geo-checks";
import type {
  GeoRecapItem,
  GeoRecapShareRow,
} from "@notra/email/types/geo-recap";
import { engineEmailLogoSrc } from "@notra/email/utils/engine-logo";
import {
  engineFamilyLabel,
  engineFamilyOf,
} from "@notra/geo-core/utils/geo-engine-family";

import {
  GEO_FIRST_SCAN_MAX_COMPETITORS,
  GEO_FIRST_SCAN_MAX_PROMPTS,
  GEO_RECAP_PROMPT_MAX_LENGTH,
} from "@/constants/geo-recap";
import type { GeoFirstScanSummary } from "@/types/email/geo-recap";
import { formatRate, truncatePrompt } from "@/utils/geo-recap";

interface Tally {
  checks: number;
  mentions: number;
}

function rate({ checks, mentions }: Tally) {
  return checks > 0 ? mentions / checks : 0;
}

function engineRows(rows: readonly GeoCheckScanPromptRow[]) {
  const byFamily = new Map<string, Tally>();
  for (const row of rows) {
    const family = engineFamilyOf(row.engine);
    const tally = byFamily.get(family) ?? { checks: 0, mentions: 0 };
    tally.checks += row.checks;
    tally.mentions += row.mentions;
    byFamily.set(family, tally);
  }
  return [...byFamily]
    .map(([family, tally]) => ({ family, rate: rate(tally) }))
    .toSorted((left, right) => right.rate - left.rate)
    .map(({ family, rate: share }): GeoRecapShareRow => ({
      name: engineFamilyLabel(family),
      shareLabel: formatRate(share),
      iconSrc: engineEmailLogoSrc(family),
    }));
}

function mentionedPrompts(rows: readonly GeoCheckScanPromptRow[]) {
  const byPrompt = new Map<
    string,
    {
      prompt: string;
      engines: Set<string>;
      namedBy: Set<string>;
      bestPosition: number | null;
    }
  >();
  for (const row of rows) {
    const family = engineFamilyOf(row.engine);
    const entry = byPrompt.get(row.promptId) ?? {
      prompt: row.prompt,
      engines: new Set<string>(),
      namedBy: new Set<string>(),
      bestPosition: null,
    };
    entry.engines.add(family);
    if (row.mentions > 0) {
      entry.namedBy.add(family);
      if (
        row.bestPosition !== null &&
        (entry.bestPosition === null || row.bestPosition < entry.bestPosition)
      ) {
        entry.bestPosition = row.bestPosition;
      }
    }
    byPrompt.set(row.promptId, entry);
  }

  return [...byPrompt]
    .filter(([, entry]) => entry.namedBy.size > 0)
    .toSorted(
      ([, left], [, right]) =>
        right.namedBy.size / right.engines.size -
          left.namedBy.size / left.engines.size ||
        (left.bestPosition ?? Number.POSITIVE_INFINITY) -
          (right.bestPosition ?? Number.POSITIVE_INFINITY)
    )
    .map(([promptId, entry]): GeoRecapItem => {
      const rank =
        entry.bestPosition === null ? null : `#${entry.bestPosition}`;
      let detail = `Named by ${entry.namedBy.size} of ${entry.engines.size} assistants${rank ? `, best rank ${rank}` : ""}`;
      if (entry.engines.size === 1) {
        detail = rank ? `Named at rank ${rank}` : "Named in the answer";
      }
      return {
        id: promptId,
        title: truncatePrompt(entry.prompt, GEO_RECAP_PROMPT_MAX_LENGTH),
        changes: [
          {
            id: "mentioned",
            detail,
            tone: "up",
          },
        ],
      };
    });
}

/** Turns one scan's checks into the first-results email's sections. */
export function buildFirstScanSummary({
  brandName,
  prompts,
  competitors,
}: {
  brandName: string;
  prompts: readonly GeoCheckScanPromptRow[];
  competitors: readonly GeoCheckScanCompetitorRow[];
}): GeoFirstScanSummary {
  const total = prompts.reduce(
    (sum, row) => ({
      checks: sum.checks + row.checks,
      mentions: sum.mentions + row.mentions,
      visible: sum.visible + row.visible,
    }),
    { checks: 0, mentions: 0, visible: 0 }
  );
  // Competitors are counted by name, so the own row compares mentions too.
  const ownShare = rate(total);
  const ownKey = brandName.trim().toLowerCase();
  const mentioned = mentionedPrompts(prompts);
  const shownPrompts = mentioned.slice(0, GEO_FIRST_SCAN_MAX_PROMPTS);
  const competitorRows = competitors
    .filter((row) => row.brand.trim().toLowerCase() !== ownKey)
    .slice(0, GEO_FIRST_SCAN_MAX_COMPETITORS)
    .map((row) => ({
      name: row.brand,
      share: rate({ checks: total.checks, mentions: row.checks }),
      isOwnBrand: false,
    }));

  return {
    visibilityLabel: formatRate(
      rate({ checks: total.checks, mentions: total.visible })
    ),
    answersChecked: total.checks,
    promptCount: new Set(prompts.map((row) => row.promptId)).size,
    engines: engineRows(prompts),
    mentionedIn: shownPrompts,
    mentionedRemaining: mentioned.length - shownPrompts.length,
    competitors:
      competitorRows.length === 0
        ? []
        : [
            ...competitorRows,
            { name: brandName, share: ownShare, isOwnBrand: true },
          ]
            .toSorted((left, right) => right.share - left.share)
            .map((row) => ({
              name: row.name,
              shareLabel: formatRate(row.share),
              isOwnBrand: row.isOwnBrand || undefined,
            })),
  };
}
