// Navbar behaviour from usenotra.com: the floating navbar on the blog index gains its background
// once the page scrolls, the theme button flips light and dark (stored like next-themes on the
// main site), and D, L and S toggle the theme, sign in and sign up.
const root = document.documentElement;
const nav = document.querySelector('.notra-nav[data-page="index"]');

if (nav) {
  const update = () => nav.toggleAttribute("data-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

// Diagram flow animations play once, when the diagram scrolls into view.
const diagrams = document.querySelectorAll("[data-diagram]");
if (diagrams.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.setAttribute("data-seen", "");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -20% 0px" }
  );
  for (const diagram of diagrams) {
    observer.observe(diagram);
  }
}

// Page transitions like usenotra.com: a post's title morphs between its card and the post page.
// style.css names the post title, because this deferred script runs after a new page is revealed.
// When a page is left, this names the clicked card on the index, and on a post it drops the name
// unless the reader goes back to the index, so two different titles never morph into each other.
const pathOf = (url) => (url ? new URL(url).pathname.replace(/\/$/, "") : null);
const cardTitle = (path) =>
  [...document.querySelectorAll(".post-card-title a")]
    .find((link) => pathOf(link.href) === path)
    ?.closest(".post-card-title");
const nameDuring = (transition, element, name) => {
  if (!(transition && element)) {
    return;
  }
  element.style.viewTransitionName = name;
  transition.finished.finally(() => {
    element.style.viewTransitionName = "";
  });
};
window.addEventListener("pageswap", (event) => {
  const to = pathOf(event.activation?.entry.url);
  if (document.querySelector(".blog-index")) {
    nameDuring(event.viewTransition, cardTitle(to), "post-title");
    return;
  }
  const indexPath = pathOf(document.querySelector("#header > a")?.href);
  if (to !== indexPath) {
    nameDuring(
      event.viewTransition,
      document.querySelector(".post-compact #page-title"),
      "none"
    );
  }
});
window.addEventListener("pagereveal", (event) => {
  if (document.querySelector(".blog-index")) {
    nameDuring(
      event.viewTransition,
      cardTitle(pathOf(window.navigation?.activation?.from?.url)),
      "post-title"
    );
  }
});

const toggleTheme = () => {
  const next = root.classList.contains("dark") ? "light" : "dark";
  root.classList.toggle("dark", next === "dark");
  root.classList.toggle("c15t-dark", next === "dark");
  root.dataset.themeMode = next;
  localStorage.setItem(root.dataset.themeStorageKey || "theme", next);
};

for (const button of document.querySelectorAll("[data-theme-toggle]")) {
  button.addEventListener("click", toggleTheme);
}

document.addEventListener("keydown", (event) => {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return;
  }
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select"))
  ) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "d") {
    toggleTheme();
    return;
  }
  const link = document.querySelector(
    `.notra-nav-actions [data-hotkey="${key}"]`
  );
  if (link instanceof HTMLAnchorElement) {
    window.location.assign(link.href);
  }
});
