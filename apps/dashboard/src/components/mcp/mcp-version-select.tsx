"use client";

import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useTranslations } from "use-intl";

import {
  MCP_LATEST_VERSION_BADGE,
  MCP_VERSION_ALL,
} from "@/constants/mcp-analytics";
import { useMcpVersionQuery } from "@/lib/hooks/use-mcp-version";
import type { McpVersionSelectProps } from "@/types/mcp-analytics";
import { latestMcpVersion } from "@/utils/mcp-analytics";

/**
 * Narrows the page to one server version. Every version is the default; the
 * select only appears once there is more than one to pick from.
 */
export function McpVersionSelect({ versions }: McpVersionSelectProps) {
  const t = useTranslations("geo.pages.mcp.version");
  const [version, setVersion] = useMcpVersionQuery();
  const options = versions.some((entry) => entry.version === version)
    ? versions
    : [...versions, ...(version ? [{ version }] : [])];
  if (options.length < 2 && !version) {
    return null;
  }
  const latest = latestMcpVersion(versions.map((entry) => entry.version));
  return (
    <Select
      onValueChange={(next) => {
        if (next) {
          setVersion(next === MCP_VERSION_ALL ? null : next);
        }
      }}
      value={version || MCP_VERSION_ALL}
    >
      <SelectTrigger
        aria-label={t("label")}
        className="w-auto max-w-56 min-w-36"
        size="sm"
      >
        <SelectValue>
          {version ? <span className="font-mono">{version}</span> : t("all")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto max-w-(--available-width) min-w-(--anchor-width)">
        <SelectItem value={MCP_VERSION_ALL}>{t("all")}</SelectItem>
        {options.map((entry) => (
          <SelectItem key={entry.version} value={entry.version}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono">{entry.version}</span>
              {entry.version === latest ? (
                <StatusBadge
                  appearance={MCP_LATEST_VERSION_BADGE}
                  label={t("latest")}
                />
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
