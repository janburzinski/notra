import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CARD_HEIGHT, CARD_WIDTH } from "@/constants/share-card";
import {
  GAME_CARD_URL,
  GAME_DESCRIPTION,
  GAME_TITLE,
  SITE_URL,
} from "@/constants/site";

import globalsCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#100b1e" },
      { title: GAME_TITLE },
      { name: "description", content: GAME_DESCRIPTION },
      { property: "og:title", content: GAME_TITLE },
      { property: "og:description", content: GAME_DESCRIPTION },
      { property: "og:url", content: SITE_URL },
      { property: "og:type", content: "website" },
      { property: "og:image", content: GAME_CARD_URL },
      { property: "og:image:width", content: String(CARD_WIDTH) },
      { property: "og:image:height", content: String(CARD_HEIGHT) },
      { property: "og:image:alt", content: GAME_TITLE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: GAME_CARD_URL },
      { name: "twitter:site", content: "@usenotra" },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "canonical", href: SITE_URL },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
