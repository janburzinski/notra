(() => {
  const script = document.currentScript;
  const params = new URLSearchParams({
    type: "pageview",
    hostname: script.dataset.hostname,
    path: location.pathname,
    options: JSON.stringify({ ...script.dataset }),
  });
  fetch(`https://queue.simpleanalyticscdn.com/simple.gif?${params}`, {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
  });
})();
