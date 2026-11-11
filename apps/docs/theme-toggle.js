(() => {
  let pending = false;
  const toggle = () => {
    pending = false;
    const next = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    document
      .querySelector(
        `[data-component-part="theme-preference-menu-item"][data-theme-preference="${next}"]`
      )
      ?.click();
  };
  new MutationObserver(() => {
    if (
      pending ||
      !document.querySelector(
        '[data-component-part="theme-preference-menu-item"]'
      )
    ) {
      return;
    }
    pending = true;
    requestAnimationFrame(() => setTimeout(toggle, 0));
  }).observe(document.body, { childList: true, subtree: true });
})();
