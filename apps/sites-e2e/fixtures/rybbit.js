(() => {
  const script = document.currentScript;
  const siteId = new URL(script.src).searchParams.get("siteId");
  fetch(`${script.src.split("/script.js")[0]}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "pageview",
      site_id: siteId,
      hostname: location.hostname,
      pathname: location.pathname,
      options: { ...script.dataset },
    }),
  });
})();
