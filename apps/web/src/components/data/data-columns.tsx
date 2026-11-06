import type { TableColumn } from "ui/table";

import {
  DataPurpose,
  DataShareBar,
  DataSource,
} from "@/components/data/data-cells";
import { DataTrend } from "@/components/data/data-trend";
import { MutedText } from "@/components/state-of-ai-search/report-ui";
import {
  DATA_CRAWLER_BAR_CLASS,
  DATA_REFERRAL_BAR_CLASS,
} from "@/constants/data";
import type { DataPageModel } from "@/types/data";
import {
  countryFlag,
  formatShare,
  formatVisits,
  relativeTrend,
} from "@/utils/data";

type Ranked<T> = T & { rank: number };
type Crawler = Ranked<DataPageModel["crawlers"][number]>;
type Assistant = Ranked<DataPageModel["assistants"][number]>;
type Country = Ranked<DataPageModel["countries"][number]>;
type AgentFile = DataPageModel["agentFiles"][number];

/** Share columns keep their bar on desktop and narrow to the figure on phones, where the bar hides. */
const SHARE_COLUMN_WIDTH = "min(9.5rem, 26vw)";

const RANK_COLUMN = {
  key: "rank",
  header: "#",
  width: "3.25rem",
  sortable: true,
  cell: (row: { rank: number }) => <MutedText>{row.rank}</MutedText>,
};

const changeColumn = <
  T extends { change: number | null },
>(): TableColumn<T> => ({
  key: "change",
  header: "Change",
  align: "right",
  width: "6.5rem",
  // Collapses last: on phones the table keeps the name and its main figure.
  collapsePriority: 1,
  sortable: true,
  sortValue: (row) => row.change ?? Number.NEGATIVE_INFINITY,
  cell: (row) => <DataTrend trend={relativeTrend(row.change)} />,
});

export function crawlerColumns(top: number): TableColumn<Crawler>[] {
  return [
    RANK_COLUMN,
    {
      key: "label",
      header: "Crawler",
      width: "2fr",
      sortable: true,
      cell: (row) => <DataSource label={row.label} vendor={row.vendor} />,
    },
    {
      key: "purpose",
      header: "Purpose",
      width: "10rem",
      collapsePriority: 3,
      cell: (row) => <DataPurpose purpose={row.purpose} />,
    },
    {
      key: "share",
      header: "Share",
      hint: "Share of all AI crawler visits last week.",
      align: "right",
      width: SHARE_COLUMN_WIDTH,
      collapsePriority: 2,
      sortable: true,
      cell: (row) => (
        <DataShareBar
          barClassName={DATA_CRAWLER_BAR_CLASS}
          max={top}
          text={formatShare(row.share)}
          value={row.share}
        />
      ),
    },
    {
      key: "dailyPerSite",
      header: "Visits",
      hint: "Average visits per measured site per day, last week.",
      align: "right",
      width: "7rem",
      sortable: true,
      cell: (row) => (
        <span className="font-medium tabular-nums">
          {formatVisits(row.dailyPerSite)}
        </span>
      ),
    },
    changeColumn<Crawler>(),
  ];
}

export function assistantColumns(
  top: number,
  withDepth: boolean
): TableColumn<Assistant>[] {
  return [
    RANK_COLUMN,
    {
      key: "label",
      header: "Assistant",
      width: "2fr",
      sortable: true,
      cell: (row) => <DataSource label={row.label} vendor={row.vendor} />,
    },
    {
      key: "share",
      header: "Share",
      align: "right",
      width: SHARE_COLUMN_WIDTH,
      sortable: true,
      cell: (row) => (
        <DataShareBar
          barClassName={DATA_REFERRAL_BAR_CLASS}
          max={top}
          text={formatShare(row.share)}
          value={row.share}
        />
      ),
    },
    ...(withDepth
      ? [
          {
            key: "pagesPerVisit",
            header: "Pages/visit",
            align: "right",
            width: "7rem",
            collapsePriority: 2,
            sortable: true,
            sortValue: (row: Assistant) => row.pagesPerVisit ?? 0,
            cell: (row: Assistant) => (
              <span className="font-medium tabular-nums">
                {row.pagesPerVisit === null
                  ? "–"
                  : formatVisits(row.pagesPerVisit)}
              </span>
            ),
          } satisfies TableColumn<Assistant>,
          {
            key: "multiPageShare",
            header: "Second page",
            hint: "Share of visits that went on to a second page.",
            align: "right",
            width: "8rem",
            collapsePriority: 3,
            sortable: true,
            sortValue: (row: Assistant) => row.multiPageShare ?? 0,
            cell: (row: Assistant) => (
              <MutedText>{formatShare(row.multiPageShare)}</MutedText>
            ),
          } satisfies TableColumn<Assistant>,
        ]
      : []),
    changeColumn<Assistant>(),
  ];
}

export function countryColumns(top: number): TableColumn<Country>[] {
  return [
    RANK_COLUMN,
    {
      key: "name",
      header: "Country",
      width: "2fr",
      sortable: true,
      cell: (row) => (
        <span className="text-foreground flex items-center gap-2">
          <span aria-hidden="true">{countryFlag(row.country)}</span>
          {row.name}
        </span>
      ),
    },
    {
      key: "share",
      header: "Share",
      align: "right",
      width: SHARE_COLUMN_WIDTH,
      sortable: true,
      cell: (row) => (
        <DataShareBar
          barClassName={DATA_REFERRAL_BAR_CLASS}
          max={top}
          text={formatShare(row.share)}
          value={row.share}
        />
      ),
    },
    changeColumn<Country>(),
  ];
}

export const AGENT_FILE_COLUMNS: TableColumn<AgentFile>[] = [
  {
    key: "label",
    header: "Crawler",
    width: "2fr",
    sortable: true,
    cell: (row) => <DataSource label={row.label} vendor={row.vendor} />,
  },
  {
    key: "llmsTxtReach",
    header: "llms.txt",
    hint: "Share of the sites it visited where it fetched /llms.txt.",
    align: "right",
    width: SHARE_COLUMN_WIDTH,
    sortable: true,
    cell: (row) => (
      <DataShareBar
        barClassName={DATA_CRAWLER_BAR_CLASS}
        text={formatShare(row.llmsTxtReach)}
        value={row.llmsTxtReach}
      />
    ),
  },
  {
    key: "markdownShare",
    header: "Markdown",
    hint: "Share of its requests that asked for Markdown.",
    align: "right",
    width: "7rem",
    collapsePriority: 1,
    sortable: true,
    cell: (row) => <MutedText>{formatShare(row.markdownShare)}</MutedText>,
  },
];
