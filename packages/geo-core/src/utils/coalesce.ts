/**
 * Concurrent calls with the same key share one in-flight lookup. Nothing is
 * kept after it settles, so a result is never older than the lookup itself.
 */
export function coalesce<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  load: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
  const inFlight = new Map<string, Promise<R>>();
  return (...args) => {
    const key = keyOf(...args);
    const existing = inFlight.get(key);
    if (existing) {
      return existing;
    }
    const lookup = load(...args).finally(() => inFlight.delete(key));
    inFlight.set(key, lookup);
    return lookup;
  };
}
