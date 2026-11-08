(() => {
  const script = document.currentScript;
  fetch("https://datafa.st/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "pageview",
      websiteId: script.dataset.websiteId,
      domain: script.dataset.domain,
      href: location.href,
      options: { ...script.dataset },
    }),
  });
})();
