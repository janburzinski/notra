import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

import { loadCatalog } from "@/lib/i18n/catalog";
import { localeFromPathname } from "@/utils/landing-locale";

function hydrate() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>
    );
  });
}

function start() {
  loadCatalog(localeFromPathname(window.location.pathname))
    .catch(() => undefined)
    .finally(hydrate);
}

start();
