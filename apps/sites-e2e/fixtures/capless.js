(() => {
  const key = document.currentScript.dataset.key;
  fetch(`https://c.capless.sh/e?k=${key}`, {
    method: "POST",
    body: JSON.stringify({ e: [["pageview", location.href]] }),
  });
})();
