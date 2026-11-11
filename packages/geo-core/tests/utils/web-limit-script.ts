type BudgetLimit = (identifier: string) => Promise<{ success: boolean }>;

/**
 * Stands in for the web limit script: each budget's key goes, in order, to
 * the limit registered for its prefix until one refuses; when all admit, the
 * daily counter, if any, counts up from 1.
 */
export function fakeWebLimitScript(limits: Record<string, BudgetLimit>) {
  const prefixes = Object.keys(limits).toSorted((a, b) => b.length - a.length);
  const counts = new Map<string, number>();
  return async (keys: string[]): Promise<[number, number]> => {
    const budgets = Math.floor(keys.length / 2);
    for (let index = 0; index < budgets; index += 1) {
      const windowKey = keys[index * 2] ?? "";
      const key = windowKey.slice(0, windowKey.lastIndexOf(":"));
      const prefix = prefixes.find((item) => key.startsWith(`${item}:`));
      const limit = prefix === undefined ? undefined : limits[prefix];
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- budgets are checked in order
      if (!(limit && (await limit(key.slice(`${prefix}:`.length))).success)) {
        return [index, 0];
      }
    }
    const counter = keys[budgets * 2];
    if (counter === undefined) {
      return [budgets, 0];
    }
    const count = (counts.get(counter) ?? 0) + 1;
    counts.set(counter, count);
    return [budgets, count];
  };
}
