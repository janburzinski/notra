(() => {
  let toast;
  let hideTimer;

  const showToast = (text) => {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "pm-toast";
      toast.setAttribute("role", "status");
      document.body.append(toast);
    }
    toast.textContent = text;
    toast.dataset.visible = "true";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      toast.dataset.visible = "false";
    }, 1600);
  };

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
    if (!target) return;

    const value = target.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(value);
      target.dataset.copied = "true";
      setTimeout(() => delete target.dataset.copied, 1200);
      showToast(`Copied ${value}`);
    } catch {
      showToast("Copying is blocked here. Select the name and copy it by hand.");
    }
  });
})();
