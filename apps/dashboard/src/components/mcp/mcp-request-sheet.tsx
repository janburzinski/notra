"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import { Sheet } from "@notra/ui/components/ui/sheet";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { AgentFeedbackAgentIcon } from "@/components/agent-feedback/feedback-agent-icon";
import { CodeSnippet } from "@/components/geo/code-snippet";
import {
  McpPropertyTable,
  McpSheetHeader,
} from "@/components/mcp/mcp-sheet-parts";
import {
  JSON_RPC_ERROR_KEYS,
  MCP_ELICITATION_OUTCOME_VARIANTS,
} from "@/constants/mcp-analytics";
import type {
  McpPayloadSnippetsProps,
  McpRequestSheetProps,
  McpRequestStatusBadgeProps,
} from "@/types/mcp-analytics";
import { formatBytes, formatMilliseconds } from "@/utils/format";
import { elicitationOutcome, prettyJson } from "@/utils/mcp-analytics";

export function McpRequestStatusBadge({ entry }: McpRequestStatusBadgeProps) {
  const t = useTranslations("geo.pages.mcp");
  const outcome = elicitationOutcome(entry.outcome);
  if (entry.status === "ok" && outcome) {
    return (
      <Badge variant={MCP_ELICITATION_OUTCOME_VARIANTS[outcome]}>
        {t(`status.${outcome}`)}
      </Badge>
    );
  }
  if (entry.status === "ok") {
    return <Badge variant="success">{t("status.ok")}</Badge>;
  }
  if (entry.status === "tool_error") {
    return <Badge variant="warning">{t("status.toolError")}</Badge>;
  }
  const errorKey = JSON_RPC_ERROR_KEYS[entry.errorCode];
  return (
    <Badge variant="destructive">
      {errorKey
        ? t(`rpcErrors.${errorKey}`)
        : t("rpcErrors.other", { code: entry.errorCode })}
    </Badge>
  );
}

function McpPayloadSnippets({
  arguments: args,
  response,
}: McpPayloadSnippetsProps) {
  const t = useTranslations("geo.pages.mcp.requestSheet");
  return (
    <>
      {args ? (
        <CodeSnippet code={prettyJson(args)} filename={t("arguments")} />
      ) : null}
      {response ? (
        <CodeSnippet code={prettyJson(response)} filename={t("response")} />
      ) : null}
    </>
  );
}

export function McpRequestSheet({
  entry,
  open,
  onOpenChange,
}: McpRequestSheetProps) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("geo.pages.mcp");
  const client = entry?.clientName || t("fallback.unknownClient");

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <DetailSheetContent size="md">
        {entry ? (
          <>
            <McpSheetHeader
              description={`${formatMilliseconds(entry.durationMs, locale)} · ${format.dateTime(
                new Date(entry.capturedAt),
                { dateStyle: "medium", timeStyle: "medium" }
              )}`}
              icon={<AgentFeedbackAgentIcon client={client} />}
              title={
                <>
                  <span className="min-w-0 truncate font-mono">
                    {entry.method}
                    {entry.target ? (
                      <span className="text-muted-foreground">
                        {" "}
                        {entry.target}
                      </span>
                    ) : null}
                  </span>
                  <McpRequestStatusBadge entry={entry} />
                </>
              }
            />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">
              <McpPropertyTable
                rows={[
                  {
                    key: "error",
                    label: t("requestSheet.error"),
                    value: entry.errorMessage || null,
                  },
                  {
                    key: "client",
                    label: t("requestSheet.client"),
                    value: `${client} ${entry.clientVersion}`.trim(),
                  },
                  {
                    key: "intent",
                    label: t("requestSheet.intent"),
                    value: entry.intent || null,
                  },
                  {
                    key: "user",
                    label: t("requestSheet.user"),
                    value: entry.userId || null,
                  },
                  {
                    key: "model",
                    label: t("requestSheet.model"),
                    value: entry.model || null,
                  },
                  {
                    key: "size",
                    label: t("requestSheet.responseSize"),
                    value: formatBytes(entry.responseBytes, locale),
                  },
                  {
                    key: "protocol",
                    label: t("requestSheet.protocol"),
                    value: entry.protocolVersion || null,
                  },
                  {
                    key: "rpcError",
                    label: t("requestSheet.rpcError"),
                    value:
                      entry.status === "rpc_error"
                        ? String(entry.errorCode)
                        : null,
                  },
                  {
                    key: "session",
                    label: t("requestSheet.sessionId"),
                    value: entry.sessionId || null,
                  },
                ]}
              />
              <McpPayloadSnippets
                arguments={entry.arguments}
                response={entry.response}
              />
            </div>
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}
