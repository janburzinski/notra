import type { PublicAiTrafficSnapshot } from "@notra/schemas/types/api/public-ai-traffic";

import {
  DATA_DESCRIPTION,
  DATA_JSON_URL,
  DATA_PURPOSE_LABELS,
  DATA_TITLE,
  DATA_URL,
} from "@/constants/data";
import { loadDataSnapshot } from "@/lib/data/snapshot";
import {
  formatChange,
  formatDataDay,
  formatRatio,
  formatShare,
  formatVisits,
} from "@/utils/data";
import { markdownSection, markdownTable } from "@/utils/markdown";

function header(snapshot: PublicAiTrafficSnapshot | null): string[] {
  return [
    `# ${DATA_TITLE}`,
    "",
    DATA_DESCRIPTION,
    "",
    `- Page: ${DATA_URL}`,
    `- JSON: ${DATA_JSON_URL}`,
    snapshot
      ? `- Data through: ${snapshot.day} (UTC), generated ${snapshot.generatedAt}`
      : "- Data through: not published yet",
    "",
  ];
}

function buildDataMarkdownFromSnapshot(
  snapshot: PublicAiTrafficSnapshot | null
): string {
  if (!snapshot?.available) {
    return [
      ...header(snapshot),
      "Today's snapshot isn't ready yet. New numbers are published once a day.",
      "",
    ].join("\n");
  }
  const recent = `${formatDataDay(snapshot.window.recentFrom)} – ${formatDataDay(snapshot.day)}`;
  const sections = [
    markdownSection("Summary", [
      `- Crawls per AI referral: ${formatRatio(snapshot.summary.crawlsPerReferral)}`,
      `- Share of AI crawls for model training: ${formatShare(snapshot.summary.trainingShare)}`,
      `- Share of AI crawls asking for Markdown: ${formatShare(snapshot.summary.markdownShare)}`,
    ]),
    markdownSection(`Top AI crawlers, ${recent}`, [
      markdownTable(
        [
          { header: "#", align: "right" },
          { header: "Bot" },
          { header: "Company" },
          { header: "Purpose" },
          { header: "Share of crawls", align: "right" },
          { header: "vs. prior week", align: "right" },
          { header: "Sites reached", align: "right" },
          { header: "Visits/site/day", align: "right" },
          { header: "Median site/day", align: "right" },
          { header: "Asks for Markdown", align: "right" },
        ],
        snapshot.crawlers.map((row, index) => [
          String(index + 1),
          row.label,
          row.vendor ?? "–",
          DATA_PURPOSE_LABELS[row.purpose] ?? (row.purpose || "–"),
          formatShare(row.share),
          formatChange(row.change),
          formatShare(row.reach),
          formatVisits(row.dailyPerSite),
          formatVisits(row.medianDailyVisits),
          formatShare(row.markdownShare),
        ])
      ),
    ]),
    markdownSection(`Crawl purpose, ${recent}`, [
      markdownTable(
        [
          { header: "Purpose" },
          { header: "Share of crawls", align: "right" },
          { header: "Prior week", align: "right" },
        ],
        snapshot.purposes.map((row) => [
          DATA_PURPOSE_LABELS[row.purpose] ?? row.purpose,
          formatShare(row.share),
          formatShare(row.previousShare),
        ])
      ),
    ]),
    markdownSection("Top AI referrers, last 28 days", [
      markdownTable(
        [
          { header: "#", align: "right" },
          { header: "Assistant" },
          { header: "Company" },
          { header: "Share of referrals", align: "right" },
          { header: "vs. prior 4 weeks", align: "right" },
          { header: "Sites reached", align: "right" },
        ],
        snapshot.referrers.map((row, index) => [
          String(index + 1),
          row.label,
          row.vendor ?? "–",
          formatShare(row.share),
          formatChange(row.change),
          formatShare(row.reach),
        ])
      ),
    ]),
    markdownSection("Crawls per referral, last 28 days", [
      markdownTable(
        [
          { header: "Company" },
          { header: "Share of crawls", align: "right" },
          { header: "Crawls per referral", align: "right" },
        ],
        snapshot.vendors.map((row) => [
          row.vendor,
          formatShare(row.crawlShare),
          formatRatio(row.crawlsPerReferral),
        ])
      ),
    ]),
    markdownSection("Methodology", [
      "- Visits come from sites that measure AI traffic with Notra: requests from known AI crawlers, and page views referred by AI assistants.",
      `- Aggregated and anonymized. Only shares, reach and per-site medians are published. A bot, assistant or company appears only after reaching at least ${snapshot.minSites} different sites; a chart day only when that many sites had AI traffic.`,
      "- Sample projects and demo accounts are excluded. Days are UTC; snapshots cover full days and end with yesterday.",
      "- “vs. prior week” compares the last 7 days with the 7 before, over sites measured in both weeks. Assistants rank over the last 28 days against the 28 before, since referrals are sparse.",
      "- Published once a day. Cite as “Notra AI Traffic Data, usenotra.com/data” with the snapshot date.",
    ]),
  ];
  return [...header(snapshot), ...sections].join("\n");
}

export async function buildDataMarkdown(): Promise<string> {
  return buildDataMarkdownFromSnapshot(await loadDataSnapshot());
}
