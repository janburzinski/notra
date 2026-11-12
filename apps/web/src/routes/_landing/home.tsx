import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing/landing-page";
import { LANDING_PAGE_METADATA } from "@/constants/landing/metadata";
import { getLandingFlags } from "@/lib/landing-flags/functions";
import { buildHead } from "@/utils/head";

export const Route = createFileRoute("/_landing/home")({
  loader: () => getLandingFlags(),
  head: () => buildHead(LANDING_PAGE_METADATA),
  shouldReload: false,
  component: LandingRoute,
});

function LandingRoute() {
  return <LandingPage flags={Route.useLoaderData()} />;
}
