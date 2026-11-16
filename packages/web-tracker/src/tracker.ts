// Runs on customer pages, so every byte and every millisecond counts. Startup
// avoids storage, URL parsing, crypto and layout reads (each measurably costs
// ~0.2-10 ms on a throttled phone); there are no timers, and there is one
// beacon per page view plus one each time the page is hidden. Outbound link
// clicks and (in notra.plus.js) errors each send one more beacon only when
// they happen. Web vitals ride on the hide beacon.

/** Set at build time: true for notra.plus.js, which adds error reporting. */
declare const NOTRA_PLUS: boolean;

(() => {
  const doc = document;
  const win = window;
  const nav = navigator;
  const loc = location;
  const perf = performance;
  // `type="module"` scripts have no currentScript; find the tag instead.
  const script = (doc.currentScript ||
    doc.querySelector(
      "script[data-key][src*=notra]"
    )) as HTMLScriptElement | null;
  const data = script?.dataset;
  const key = data?.key;
  const flags = win as unknown as { __notra?: 1 };
  if (
    !(script && key) ||
    top !== win ||
    nav.webdriver ||
    // A second copy of the tag would wrap history again and count twice.
    flags.__notra ||
    // Loopback only: not localhost-staging.example.com or 127.example.com.
    /(^|\.)localhost$|^127\.\d+\.\d+\.\d+$|^\[::1\]$/.test(loc.hostname)
  ) {
    return;
  }
  flags.__notra = 1;
  const endpoint =
    data.api || script.src.replace(/^(\w+:\/\/[^/]+).*/, "$1/api/collect");
  const withHash = "hash" in data;
  const now = () => perf.now();
  const round = Math.round;
  const on = addEventListener;

  let view = "";
  let url = "";
  let visible = 0;
  let reported = 0;
  let shownAt = 0;
  let maxScroll = 0;
  let viewStart = 0;
  let hard = true;
  let lcp = 0;
  let cls = 0;
  let clsWindow = 0;
  let clsFirst = 0;
  let clsLast = 0;
  let inp = 0;
  let errors = 0;

  // `h` tells the server the page uses hash routes, so it keeps `#/route`.
  // URLs are cut so the body stays under the server's 4 KB limit (a long
  // URL used to fail the whole beacon); the server keeps 2048 characters.
  const send = (fields: object) => {
    const body = JSON.stringify({
      k: key,
      v: view,
      u: url.slice(0, 2048),
      h: withHash,
      ...fields,
    });
    // A CORS fetch carries the page's origin even under a no-referrer
    // policy, where sendBeacon's no-cors request would say `Origin: null`.
    // A text/plain body needs no preflight; keepalive outlives the page.
    // Only a fetch that throws falls back: a page that unloads sees its
    // delivered keepalive fetch reject, so a rejection proves nothing.
    try {
      fetch(endpoint, {
        method: "POST",
        body,
        keepalive: true,
        credentials: "omit",
      }).catch(() => 0);
    } catch {
      nav.sendBeacon(endpoint, body);
    }
  };

  const report = () => {
    if (shownAt) {
      visible += now() - shownAt;
      shownAt = 0;
    }
    if (view && visible - reported >= 1) {
      reported = visible;
      const room = doc.documentElement.scrollHeight - win.innerHeight;
      // Load metrics only describe the document's own navigation, not SPA views.
      const entry =
        hard &&
        (perf.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined);
      send({
        t: round(visible),
        s: room > 0 ? Math.min(100, round((maxScroll / room) * 100)) : 100,
        // Only Chromium reports layout shifts; elsewhere CLS is unknown, not 0.
        ...("LayoutShift" in win && { c: round(cls * 1000) }),
        i: round(inp),
        ...(entry && {
          l: round(lcp),
          f: round(
            perf.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0
          ),
          b: round(entry.responseStart),
        }),
      });
    }
  };

  // With data-hash only `#/route` and `#!/route` are pages: an in-page
  // anchor (`#features`) or an OAuth fragment (`#access_token=…`) is not.
  const hashRoute = () => (withHash && /^#!?\//.test(loc.hash) ? loc.hash : "");
  const href = () => loc.href.replace(/#.*/, "") + hashRoute();

  const start = (force?: unknown) => {
    const next = href();
    if (next !== url || force === true) {
      report();
      // Only the referrer's host and path are used; 1 KB is plenty.
      const referrer = (url || doc.referrer).slice(0, 1024);
      hard = !url;
      url = next;
      // Unique per page view, not a secret: no need for the slower crypto API.
      view = (Date.now().toString(36) + Math.random().toString(36).slice(2))
        .padEnd(16, "0")
        .slice(0, 24);
      // Reading scrollY here would force a synchronous layout before first
      // paint; a restored scroll position arrives as a scroll event instead.
      visible = 0;
      reported = 0;
      maxScroll = 0;
      cls = 0;
      clsWindow = 0;
      inp = 0;
      // The first view owns everything since navigation began, including
      // layout shifts before this deferred script ran. A later view starts
      // at the event that caused it, so the click that navigates an SPA
      // counts toward the new view's INP instead of neither view's.
      viewStart = hard ? 0 : (win.event?.timeStamp ?? now());
      if (NOTRA_PLUS) {
        errors = 0;
      }
      shownAt = doc.hidden ? 0 : now();
      send({ r: referrer });
    }
  };

  // A replace that keeps the route (filters, sort order) is the same view.
  // With data-hash the route includes the hash, cut before its query.
  // It still moves the current URL, so a later push back to the bare route
  // (clearing the filters) is a new view rather than "no change".
  const route = () => loc.pathname + hashRoute().replace(/\?.*/, "");
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    // oxlint-disable-next-line no-loop-func -- `url` is meant to be the live view's URL.
    history[method] = function (...args) {
      const before = route();
      original.apply(this, args);
      if (method < "r" || before !== route()) {
        start();
      } else if (url) {
        url = href();
      }
    };
  }
  on("popstate", start);
  if (withHash) {
    on("hashchange", start);
  }
  // Scroll events cannot be cancelled, so `passive` would change nothing.
  on("scroll", () => {
    maxScroll = Math.max(maxScroll, win.scrollY);
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) {
      report();
    } else {
      shownAt ||= now();
    }
  });
  on("pagehide", report);
  on(
    "pageshow",
    (event: PageTransitionEvent) => event.persisted && start(true)
  );

  // A click on a link to another host sends its host and path: no link text
  // and no query string, since either can carry personal data.
  const onClick = (event: MouseEvent) => {
    // Left and middle button; a right click only opens the context menu.
    // composedPath()[0] is the real target, also inside an open shadow root,
    // where event.target is only the shadow host.
    const el =
      event.button < 2
        ? ((event.composedPath()[0] as Element).closest?.(
            "a"
          ) as HTMLAnchorElement | null)
        : null;
    if (el?.host && el.host !== loc.host) {
      send({ o: el.host + el.pathname });
    }
  };
  on("click", onClick, true);
  on("auxclick", onClick, true);

  // Core Web Vitals without the web-vitals library: CLS uses its session
  // windows (1 s gap, 5 s cap) and INP the slowest interaction, both per view.
  const observe = (type: string, onEntry: (entry: any) => void) => {
    try {
      new PerformanceObserver((list) =>
        list.getEntries().forEach(onEntry)
      ).observe({
        type,
        buffered: true,
        // The minimum: at 40 a view with only quick interactions reported
        // no INP at all, which left the fast views out of p75.
        durationThreshold: 16,
      } as PerformanceObserverInit);
    } catch {
      // No PerformanceObserver, or an entry type this browser lacks.
    }
  };
  observe("largest-contentful-paint", (entry) => {
    lcp = entry.startTime;
  });
  observe("layout-shift", (entry) => {
    if (!entry.hadRecentInput && entry.startTime >= viewStart) {
      if (
        entry.startTime - clsLast > 1000 ||
        entry.startTime - clsFirst > 5000
      ) {
        clsWindow = 0;
        clsFirst = entry.startTime;
      }
      clsWindow += entry.value;
      clsLast = entry.startTime;
      cls = Math.max(cls, clsWindow);
    }
  });
  observe("event", (entry) => {
    if (entry.interactionId && entry.startTime >= viewStart) {
      inp = Math.max(inp, entry.duration);
    }
  });

  if (NOTRA_PLUS) {
    // Only errors from scripts served over http(s): extensions and opaque
    // cross-origin "Script error." are noise. At most 5 per view and never a
    // stack; the server drops the source's query (the page URL already
    // carries one) and scrubs the message before storing either.
    const onError = (message: unknown, source = "", line = 0) => {
      if (view && /^https?:/.test(source) && errors++ < 5) {
        send({
          x: String(message).slice(0, 300),
          xs: source.slice(0, 512),
          xl: line,
        });
      }
    };
    on("error", (event: ErrorEvent) =>
      onError(event.message, event.filename, event.lineno)
    );
    on("unhandledrejection", (event: PromiseRejectionEvent) =>
      onError(event.reason?.message ?? event.reason, url)
    );
  }

  if ((doc as Document & { prerendering?: boolean }).prerendering) {
    // Fired once, when the prerendered page is shown.
    doc.addEventListener("prerenderingchange", start);
  } else {
    start();
  }
})();
