/**
 * How long a client navigation to an `ssrDataOnly` route may take before the
 * router shows its pending component. Its loader returns at once, so the
 * router commits the page itself instead of a pending state that would
 * unmount it; only a page chunk that is still downloading takes longer.
 */
export const SSR_DATA_ONLY_PENDING_MS = 500;
