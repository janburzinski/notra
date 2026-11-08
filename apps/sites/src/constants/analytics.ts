export const ANALYTICS_EVENT_MAX_BYTES = 4096;

export const ANALYTICS_SCRIPT_CACHE_CONTROL = "public, max-age=3600";

// No layout reads until the page is hidden: reading scrollHeight at startup or
// while scrolling forces a synchronous layout (about 10 ms on a slow phone).
export const ANALYTICS_SCRIPT = `(() => {
  const script = document.currentScript;
  const endpoint = script && script.dataset.endpoint;
  if (!endpoint || window.top !== window || !navigator.sendBeacon) return;
  if ("view" in script.dataset) {
    navigator.sendBeacon(
      endpoint,
      JSON.stringify({ k: "view", p: location.pathname + location.search, r: document.referrer })
    );
  }
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2))
    .padEnd(16, "0")
    .slice(0, 24);
  let total = 0;
  let maxScroll = 0;
  let reported = 0;
  let shownAt = document.visibilityState === "visible" ? performance.now() : null;
  const report = () => {
    if (shownAt !== null) {
      total += performance.now() - shownAt;
      shownAt = null;
    }
    if (total - reported < 1) return;
    reported = total;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    const depth = room > 0 ? Math.round(Math.min(1, maxScroll / room) * 100) : 100;
    navigator.sendBeacon(
      endpoint,
      JSON.stringify({ v: id, p: location.pathname, ms: Math.round(total), sd: depth })
    );
  };
  addEventListener("scroll", () => {
    if (window.scrollY > maxScroll) maxScroll = window.scrollY;
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") report();
    else if (shownAt === null) shownAt = performance.now();
  });
  addEventListener("pagehide", report);
})();
`;
