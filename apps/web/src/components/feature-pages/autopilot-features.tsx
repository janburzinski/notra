import { cn } from "@notra/ui/lib/utils";

import { AutopilotCardBrief } from "@/components/feature-pages/autopilot-card-brief";
import { AutopilotCardDrafts } from "@/components/feature-pages/autopilot-card-drafts";
import { AutopilotCardResults } from "@/components/feature-pages/autopilot-card-results";
import { AutopilotCardWorkflow } from "@/components/feature-pages/autopilot-card-workflow";
import { FeaturesCard } from "@/components/landing/features-card";
import {
  AUTOPILOT_BRIEF_CARD,
  AUTOPILOT_DRAFTS_CARD,
  AUTOPILOT_FEATURES_ID,
  AUTOPILOT_PAGE,
  AUTOPILOT_RESULTS_CARD,
  AUTOPILOT_WORKFLOW_CARD,
} from "@/constants/feature-pages/autopilot";
import {
  FEATURE_SECTION_CLASS,
  FEATURE_SECTION_HEADING_CLASS,
} from "@/constants/feature-pages/layout";

export function AutopilotFeatures() {
  return (
    <section
      className={cn(FEATURE_SECTION_CLASS, "flex scroll-mt-24 flex-col gap-12")}
      id={AUTOPILOT_FEATURES_ID}
    >
      <div className="flex max-w-3xl flex-col gap-3">
        <h2 className={FEATURE_SECTION_HEADING_CLASS}>
          {AUTOPILOT_PAGE.overview.heading}
        </h2>
        <p className="font-sans text-[1.0625rem]/6.75 text-[#6B6B6B] dark:text-white/60">
          {AUTOPILOT_PAGE.overview.description}
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
        <FeaturesCard copy={AUTOPILOT_WORKFLOW_CARD.copy}>
          <AutopilotCardWorkflow />
        </FeaturesCard>
        <FeaturesCard copy={AUTOPILOT_BRIEF_CARD.copy}>
          <AutopilotCardBrief />
        </FeaturesCard>
        <FeaturesCard copy={AUTOPILOT_DRAFTS_CARD.copy}>
          <AutopilotCardDrafts />
        </FeaturesCard>
        <FeaturesCard copy={AUTOPILOT_RESULTS_CARD.copy}>
          <AutopilotCardResults />
        </FeaturesCard>
      </div>
    </section>
  );
}
