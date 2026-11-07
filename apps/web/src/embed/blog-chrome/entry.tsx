// usenotra.com's navbar and dither backgrounds for the blog on Notra Sites. `bun run blog:chrome`
// bundles this file into apps/blog/scripts/web-chrome.js. Each element the blog marks with
// data-notra-web gets a shadow root with this app's own CSS, so the blog's styles and these
// components never affect each other.
import { DropdownMenuPortalContainer } from "@notra/ui/components/ui/dropdown-menu";
import { ThemeProvider } from "next-themes";
import { createRoot } from "react-dom/client";

import "@/styles/globals.css";

import { BlogCardDither } from "@/components/blog-card-dither";
import { FooterDither } from "@/components/footer-section";
import { CtaBannerDither } from "@/components/landing/cta-banner";
import { HeroDither } from "@/components/landing/hero-dither";
import { Navbar } from "@/components/navbar";
import {
  BLOG_CHROME_INDEX_PAGE,
  BLOG_CHROME_PAPER_STYLE_SELECTOR,
  BLOG_CHROME_ROOT_RELATIVE_PATH,
  BLOG_CHROME_SITE_ORIGIN,
} from "@/constants/blog-chrome";
import type { BlogChromeMount } from "@/types/blog-chrome";

import { documentRules, shadowSheet } from "./styles";

declare const __WEB_CHROME_CSS__: string;

const MOUNTS: Record<string, BlogChromeMount> = {
  // The index floats the navbar over its hero. Every other page keeps it in the flow, like the
  // header.mdx fallback, so the page starts below it.
  navbar: (host) => (
    <Navbar
      variant={
        host.dataset.page === BLOG_CHROME_INDEX_PAGE ? "landing" : "static"
      }
    />
  ),
  "hero-dither": () => <HeroDither />,
  "footer-dither": () => <FooterDither />,
  "cta-dither": () => <CtaBannerDither />,
  "card-dither": (host) => <BlogCardDither slug={host.dataset.slug ?? ""} />,
};

const sheet = shadowSheet(__WEB_CHROME_CSS__);
const shells: HTMLElement[] = [];
const roots: ShadowRoot[] = [];

// Paper adds its canvas sizing rules to document.head, which shadow roots do not see, so every
// root gets a copy.
function sharePaperStyle(root: ShadowRoot) {
  const style = document.head.querySelector(BLOG_CHROME_PAPER_STYLE_SELECTOR);
  if (style && !root.querySelector(BLOG_CHROME_PAPER_STYLE_SELECTOR)) {
    root.prepend(style.cloneNode(true));
  }
}

// Tailwind's dark variant matches `.dark *`, which cannot see past a shadow root, so each root
// gets a wrapper that mirrors the page's theme class.
function syncTheme() {
  const dark = document.documentElement.classList.contains("dark");
  for (const shell of shells) {
    shell.classList.toggle("dark", dark);
  }
  document.documentElement.classList.toggle("c15t-dark", dark);
}

// Paths like /pricing and /notra-mark.svg belong to usenotra.com. On ntra-blog.notra.site and its
// previews they would hit the blog instead, so point them at the main site.
function pointAtSite(root: ParentNode) {
  for (const element of root.querySelectorAll<HTMLElement>("[href], [src]")) {
    for (const attribute of ["href", "src"]) {
      const value = element.getAttribute(attribute);
      if (value && BLOG_CHROME_ROOT_RELATIVE_PATH.test(value)) {
        element.setAttribute(attribute, BLOG_CHROME_SITE_ORIGIN + value);
      }
    }
  }
}

function mount(host: HTMLElement) {
  const render = MOUNTS[host.dataset.notraWeb ?? ""];
  if (!render || host.shadowRoot) {
    return;
  }
  const root = host.attachShadow({ mode: "open" });
  root.adoptedStyleSheets = [sheet];
  roots.push(root);
  sharePaperStyle(root);
  const shell = document.createElement("div");
  shell.className = "notra-web-shell";
  root.append(shell);
  shells.push(shell);
  if (window.location.origin !== BLOG_CHROME_SITE_ORIGIN) {
    new MutationObserver(() => pointAtSite(shell)).observe(shell, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["href", "src"],
    });
  }
  createRoot(shell).render(
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <DropdownMenuPortalContainer.Provider value={shell}>
        {render(host)}
      </DropdownMenuPortalContainer.Provider>
    </ThemeProvider>
  );
}

function start() {
  const rules = document.createElement("style");
  rules.textContent = documentRules(__WEB_CHROME_CSS__);
  document.head.append(rules);
  for (const card of document.querySelectorAll<HTMLElement>(
    ".post-card-box[data-post-card]"
  )) {
    const host = document.createElement("div");
    host.dataset.notraWeb = "card-dither";
    host.dataset.slug = card.dataset.postCard ?? "";
    card.prepend(host);
  }
  for (const host of document.querySelectorAll<HTMLElement>(
    "[data-notra-web]"
  )) {
    mount(host);
  }
  syncTheme();
  new MutationObserver(() => {
    for (const root of roots) {
      sharePaperStyle(root);
    }
  }).observe(document.head, { childList: true });
  new MutationObserver(syncTheme).observe(document.documentElement, {
    attributeFilter: ["class"],
  });
}

start();
