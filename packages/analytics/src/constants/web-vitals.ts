/**
 * Google's Core Web Vitals thresholds: at or below the first is good, above
 * the second is poor. Timings in ms, CLS x1000 as stored.
 */
export const WEB_VITAL_THRESHOLDS = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [100, 250],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
} as const satisfies Record<string, readonly [number, number]>;
