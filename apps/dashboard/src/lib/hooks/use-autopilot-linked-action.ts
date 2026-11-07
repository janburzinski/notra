"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect } from "react";

import { AUTOPILOT_LINK_ACTIONS } from "@/constants/autopilot-ui";
import type { AutopilotFindingView } from "@/types/autopilot";
import { linkedFindingAction } from "@/utils/autopilot-findings";

/**
 * The merge or dismiss a Slack brief button asked for with
 * ?finding=…&action=…. It shows until the dialog closes, which drops the
 * link, so a reload afterwards doesn't ask again.
 */
export function useAutopilotLinkedAction(
  findings: AutopilotFindingView[],
  canManage: boolean
) {
  const [link, setLink] = useQueryStates({
    finding: parseAsString,
    action: parseAsStringLiteral(AUTOPILOT_LINK_ACTIONS),
  });
  const pending = linkedFindingAction(link, findings, canManage);
  const hasLink = Boolean(link.finding || link.action);
  const actionable = pending !== null;

  // A link to nothing that can be merged or dismissed is dropped.
  useEffect(() => {
    if (hasLink && !actionable) {
      void setLink(null);
    }
  }, [actionable, hasLink, setLink]);

  return {
    pending,
    close: () => {
      void setLink(null);
    },
  };
}
