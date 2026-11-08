(() => {
  const script = document.currentScript;
  const hostname = script.getAttribute("data-hostname");
  fetch(
    script.getAttribute("data-url") ||
      "https://collector.onedollarstats.com/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        u: `https://${hostname}${location.pathname}`.replace(/\/$/, ""),
        e: [
          {
            t: "PageView",
            h: script.getAttribute("data-hash-routing") !== null,
          },
        ],
        options: { ...script.dataset },
      }),
    }
  );
})();
