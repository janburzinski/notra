import type { ArtifactBlock, ArtifactContent } from "@notra/ai/types/artifact";

const DAYS = [
  "Nov 8",
  "Nov 9",
  "Nov 10",
  "Nov 11",
  "Nov 12",
  "Nov 13",
  "Nov 14",
];
const points = (values: number[]) =>
  values.map((y, index) => ({ x: DAYS[index] ?? "", y }));

/** A weekly report like the chat builds: every block kind but Autopilot. */
export const ARTIFACT_REPORT: ArtifactContent = {
  title: "Weekly AI traffic",
  summary:
    "AI referrals grew 18% this week, led by ChatGPT; Gemini kept falling.",
  blocks: [
    {
      type: "metrics",
      title: "Last 7 days",
      items: [
        {
          label: "Visits",
          value: "12.4k",
          change: "+18%",
          trend: "up",
          note: "Nov 8 to Nov 14",
        },
        { label: "Signups", value: "312", change: "+9%", trend: "up" },
        { label: "Bounce rate", value: "41%", change: "-3%", trend: "up" },
        { label: "Pages per visit", value: "2.7", change: "0%", trend: "flat" },
      ],
    },
    {
      type: "text",
      markdown:
        "## What changed\n\nRefferals from ChatGPT grew for the fourth week in a row, mostly to the pricing and docs pages. Claude sent twice as many visits as last week after the launch post was cited in answers.\n\nGemini is the exception: it fell for the third week.",
    },
    {
      type: "chart",
      chart: {
        kind: "area",
        title: "Daily AI visits",
        series: [
          {
            name: "ChatGPT",
            points: points([1050, 1120, 1180, 1240, 1190, 1210, 1210]),
          },
          {
            name: "Claude",
            points: points([210, 240, 260, 330, 350, 340, 370]),
          },
        ],
      },
    },
    {
      type: "table",
      title: "By source",
      columns: ["Source", "Visits", "Change", "Share"],
      rows: [
        ["ChatGPT", 8200, "+18%", "66%"],
        ["Claude", 2100, "+104%", "17%"],
        ["Perplexity", 1100, "+6%", "8.9%"],
        ["Gemini", 640, "-12%", "5.2%"],
        ["Copilot", 210, "+2%", "1.7%"],
        ["You.com", 90, "0%", "0.7%"],
        ["Kagi", 60, "+20%", "0.5%"],
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Gemini",
      text: "Gemini traffic fell 12%. Its answers stopped citing the docs after the URL change on Nov 3.",
    },
    {
      type: "text",
      markdown:
        "## Next steps\n\n- Add redirects for the old docs URLs.\n- Write a comparison page for the pricing questions ChatGPT sends.",
    },
    {
      type: "sources",
      items: [
        { title: "Notra analytics", url: "https://app.usenotra.com/analytics" },
        { title: "Launch post", url: "https://usenotra.com/blog/launch" },
      ],
    },
  ],
};

/** What a traffic tool returned before the user asked for a report. */
export const ARTIFACT_TRAFFIC_DATA = {
  period: "Nov 8 to Nov 14",
  totals: {
    visits: 12_400,
    visitsChange: 0.18,
    signups: 312,
    signupsChange: 0.09,
  },
  daily: DAYS.map((day, index) => ({
    day,
    chatgpt: [1050, 1120, 1180, 1240, 1190, 1210, 1210][index],
    claude: [210, 240, 260, 330, 350, 340, 370][index],
  })),
  sources: [
    { source: "ChatGPT", visits: 8200, change: 0.18 },
    { source: "Claude", visits: 2100, change: 1.04 },
    { source: "Perplexity", visits: 1100, change: 0.06 },
    { source: "Gemini", visits: 640, change: -0.12 },
    { source: "Copilot", visits: 210, change: 0.02 },
    { source: "You.com", visits: 90, change: 0 },
    { source: "Kagi", visits: 60, change: 0.2 },
  ],
};

export type ArtifactBlockOf<T extends ArtifactBlock["type"]> = Extract<
  ArtifactBlock,
  { type: T }
>;
