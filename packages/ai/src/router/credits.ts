import {
  DEFAULT_CREDIT_CHECK_TTL_MS,
  DEFAULT_UNAVAILABLE_TTL_MS,
} from "@notra/ai/constants/router";
import type {
  CreditSnapshot,
  CreditTracker,
  FallbackReason,
  GatewayId,
  UnavailableMark,
} from "@notra/ai/types/router";

export function createCreditTracker(
  ttlMs: number = DEFAULT_CREDIT_CHECK_TTL_MS,
  now: () => number = () => Date.now(),
  unavailableTtlMs: number = DEFAULT_UNAVAILABLE_TTL_MS
): CreditTracker {
  const snapshots = new Map<GatewayId, CreditSnapshot>();
  const marks = new Map<string, UnavailableMark>();

  const unavailableKey = (gateway: GatewayId, modelId?: string): string =>
    modelId ? `${gateway}\0${modelId}` : gateway;

  const readUnavailableReason = (
    gateway: GatewayId,
    modelId?: string
  ): FallbackReason | undefined => {
    const key = unavailableKey(gateway, modelId);
    const mark = marks.get(key);
    if (mark && mark.until > now()) {
      return mark.reason;
    }
    if (mark) {
      marks.delete(key);
    }
    return undefined;
  };

  const isFresh = (snapshot: CreditSnapshot | undefined): boolean =>
    snapshot !== undefined && now() - snapshot.checkedAt < ttlMs;

  const isExhausted = (gateway: GatewayId): boolean => {
    const snapshot = snapshots.get(gateway);
    if (!isFresh(snapshot) || snapshot?.balance == null) {
      return false;
    }
    return snapshot.balance <= 0;
  };

  return {
    record(gateway, balance) {
      snapshots.set(gateway, { balance, checkedAt: now() });
    },
    markExhausted(gateway) {
      snapshots.set(gateway, { balance: 0, checkedAt: now() });
    },
    markUnavailable(gateway, reason, modelId) {
      marks.set(unavailableKey(gateway, modelId), {
        reason,
        until: now() + unavailableTtlMs,
      });
    },
    isExhausted,
    unavailableReason(gateway, modelId) {
      if (isExhausted(gateway)) {
        return "no-credits";
      }
      return (
        readUnavailableReason(gateway, modelId) ??
        readUnavailableReason(gateway)
      );
    },
    isStale(gateway) {
      return !isFresh(snapshots.get(gateway));
    },
    snapshot(gateway) {
      return snapshots.get(gateway);
    },
  };
}
