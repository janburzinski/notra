import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing/landing-page";
import { LANDING_PAGE_METADATA_DE } from "@/constants/landing/metadata";
import { getLandingFlags } from "@/lib/landing-flags/functions";
import { buildHead } from "@/utils/head";

export const Route = createFileRoute("/_landing/de")({
  loader: () => getLandingFlags(),
  head: () => buildHead(LANDING_PAGE_METADATA_DE),
  shouldReload: false,
  component: LandingRoute,
});

function LandingRoute() {
  return <LandingPage flags={Route.useLoaderData()} />;
}
