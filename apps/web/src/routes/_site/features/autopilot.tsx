import { createFileRoute } from "@tanstack/react-router";

import { AutopilotFeatures } from "@/components/feature-pages/autopilot-features";
import { AutopilotStage } from "@/components/feature-pages/autopilot-stage";
import { AutopilotWorksWith } from "@/components/feature-pages/autopilot-works-with";
import { FeatureDetailPage } from "@/components/feature-pages/feature-detail-page";
import { FaqSection } from "@/components/landing/faq-section";
import {
  AUTOPILOT_FAQ,
  AUTOPILOT_HEADLINE,
  AUTOPILOT_HERO_SECONDARY_CTA,
  AUTOPILOT_PAGE,
} from "@/constants/feature-pages/autopilot";
import { buildFeatureDetailHead } from "@/utils/feature-detail-page";

export const Route = createFileRoute("/_site/features/autopilot")({
  head: () => buildFeatureDetailHead(AUTOPILOT_PAGE),
  component: AutopilotPage,
});

function AutopilotPage() {
  return (
    <FeatureDetailPage
      copy={AUTOPILOT_PAGE}
      footer={<FaqSection className="py-0 lg:py-0" content={AUTOPILOT_FAQ} />}
      heroSecondaryCta={AUTOPILOT_HERO_SECONDARY_CTA}
      stage={<AutopilotStage />}
      title={AUTOPILOT_HEADLINE.map((line) => (
        <span className="block" key={line}>
          {line}
        </span>
      ))}
    >
      <AutopilotWorksWith />
      <AutopilotFeatures />
    </FeatureDetailPage>
  );
}
