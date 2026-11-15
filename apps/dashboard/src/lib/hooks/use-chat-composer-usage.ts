"use client";

import { FEATURES } from "@notra/ai/billing/features";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { useAutumnRefreshListener } from "@/lib/hooks/use-autumn-refresh-listener";
import { useBillingCustomer } from "@/lib/hooks/use-billing-customer";
import type { UseChatComposerUsageResult } from "@/types/hooks/chat-composer-usage";
import { hasIncludedChatPlan } from "@/utils/chat-billing";
import {
  getRemainingChatCredits,
  isChatUsageBlocked,
  resolveUsageLimitError,
  shouldShowLowChatCredits,
} from "@/utils/chat-input";

/**
 * The chat credits behind a composer: what's left, whether a message may go
 * out, and the error to show when it may not.
 */
export function useChatComposerUsage({
  externalError,
  onClearError,
}: {
  externalError?: string | null;
  onClearError?: () => void;
}): UseChatComposerUsageResult {
  const tSend = useTranslations("chat.input.send");
  const limitMessage = tSend("noCredits");
  const [internalError, setInternalError] = useState<string | null>(null);
  const { check, data: customer, refetch } = useBillingCustomer();
  useAutumnRefreshListener(refetch);

  const checkResult = useMemo(
    () =>
      customer
        ? check({ featureId: FEATURES.AI_CREDITS, requiredBalance: 1 })
        : null,
    [check, customer]
  );
  const chatIncludedInPlan = hasIncludedChatPlan(customer) === true;
  const remainingChatCredits = getRemainingChatCredits(
    checkResult?.balance?.remaining
  );
  const isUsageBlocked =
    isChatUsageBlocked(checkResult?.allowed, chatIncludedInPlan) === true;

  const clearError = useCallback(() => {
    setInternalError(null);
    onClearError?.();
  }, [onClearError]);

  const ensureCanSend = useCallback(() => {
    if (isUsageBlocked) {
      setInternalError(limitMessage);
      return false;
    }
    if (customer && !chatIncludedInPlan) {
      const result = check({
        featureId: FEATURES.AI_CREDITS,
        requiredBalance: 1,
      });
      if (result?.allowed === false) {
        setInternalError(limitMessage);
        return false;
      }
    }
    return true;
  }, [chatIncludedInPlan, check, customer, isUsageBlocked, limitMessage]);

  return {
    clearError,
    ensureCanSend,
    isUsageBlocked,
    remainingChatCredits,
    setInternalError,
    shouldShowLowCredits: shouldShowLowChatCredits(
      chatIncludedInPlan,
      remainingChatCredits
    ),
    usageLimitError: resolveUsageLimitError(
      externalError,
      internalError,
      isUsageBlocked,
      limitMessage
    ),
  };
}
