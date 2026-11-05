// The navbar, theme toggle, hotkeys and dither backgrounds come from scripts/web-chrome.js.

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
