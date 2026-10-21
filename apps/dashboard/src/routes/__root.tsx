import "@/lib/analytics/client-init";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  ConsentBanner,
  ConsentDialog,
  ConsentRoot,
  ConsentTheme,
  offline,
} from "c15t/tanstack-start";
import { use } from "react";
import { IntlProvider } from "use-intl";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";

import { NotFoundContent } from "@/components/not-found-content";
import {
  DUB_ANALYTICS_SCRIPTS,
  DUB_CLEAR_ON_REVOCATION,
} from "@/constants/dub";
import { resolveDashboardConsent } from "@/lib/consent-manager/resolve";
import { consentComponents, consentTheme } from "@/lib/consent-manager/theme";
import {
  catalogPreloadLinks,
  getCatalog,
  loadCatalog,
} from "@/lib/i18n/catalog";
import { getLocale } from "@/lib/i18n/server";
import { Providers } from "@/utils/providers";

import styles from "@/styles/globals.css?url";

const loadRootState = createServerFn({ method: "GET" }).handler(async () => {
  const locale = await getLocale();
  const consent = await resolveDashboardConsent(locale);
  return { locale, consent };
});

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>) => search,
  loader: async () => {
    const { locale, consent } = await loadRootState();
    await loadCatalog(locale);
    return { locale, consent };
  },
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Notra" },
      { name: "description", content: "Notra - Content Management" },
      { name: "apple-mobile-web-app-title", content: "Notra" },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: "#ffffff",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: "#0e0f12",
      },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      ...catalogPreloadLinks(loaderData?.locale),
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", href: "/icon0.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
    ],
  }),
  component: Root,
  notFoundComponent: () => <NotFoundContent className="min-h-[100svh]" />,
});

function Root() {
  const { locale, consent } = Route.useLoaderData();
  const messages = getCatalog(locale) ?? use(loadCatalog(locale));
  const app = (
    <IntlProvider locale={locale} messages={messages} timeZone="UTC">
      <Providers>
        <Outlet />
      </Providers>
    </IntlProvider>
  );
  return (
    <html className="dark:scheme-dark" lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {consent === null ? (
          app
        ) : (
          <>
            <ConsentTheme theme={consentTheme} />
            <ConsentRoot
              options={{
                consentCategories: ["necessary", "measurement"],
                theme: consentTheme,
                components: consentComponents,
                ...(process.env.NODE_ENV === "production"
                  ? {}
                  : { mode: offline() }),
              }}
              clearOnRevocation={DUB_CLEAR_ON_REVOCATION}
              scripts={DUB_ANALYTICS_SCRIPTS}
              state={consent}
            >
              {app}
              <ConsentBanner />
              <ConsentDialog />
            </ConsentRoot>
          </>
        )}
        <Scripts />
      </body>
    </html>
  );
}
