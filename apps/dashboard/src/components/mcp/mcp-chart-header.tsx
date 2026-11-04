"use client";

import { useTranslations } from "use-intl";

import {
  MCP_DAILY_SERIES,
  MCP_SERIES_DOT_CLASS,
} from "@/constants/mcp-analytics";

/** The chart title and method legend; static, so the skeleton renders it too. */
export function McpChartHeader() {
  const t = useTranslations("geo.pages.mcp.chart");
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-medium">{t("title")}</h2>
      <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {MCP_DAILY_SERIES.map((series) => (
          <li className="flex items-center gap-1.5" key={series.key}>
            <span
              aria-hidden="true"
              className={`size-2 rounded-xs ${MCP_SERIES_DOT_CLASS[series.key]}`}
            />
            <span className={series.label ? "font-mono" : undefined}>
              {series.label || t("otherMethods")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
