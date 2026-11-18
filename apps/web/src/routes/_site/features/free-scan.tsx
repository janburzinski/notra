import { createFileRoute } from "@tanstack/react-router";

import { FeatureDetailPage } from "@/components/feature-pages/feature-detail-page";
import { FreeScanStage } from "@/components/feature-pages/free-scan-stage";
import { FreeScanTable } from "@/components/feature-pages/free-scan-table";
import { FaqSection } from "@/components/landing/faq-section";
import { HeroWebsiteForm } from "@/components/landing/hero-website-form";
import {
  FREE_SCAN_FAQ,
  FREE_SCAN_HERO_CTA,
  FREE_SCAN_PAGE,
} from "@/constants/feature-pages/free-scan";
import { buildFeatureDetailHead } from "@/utils/feature-detail-page";

export const Route = createFileRoute("/_site/features/free-scan")({
  head: () => buildFeatureDetailHead(FREE_SCAN_PAGE),
  component: FreeScanPage,
});

function FreeScanPage() {
  return (
    <FeatureDetailPage
      copy={FREE_SCAN_PAGE}
      heroActions={
        <div className="flex w-[min(28rem,calc(100vw-6rem))] justify-center">
          <HeroWebsiteForm
            cta={FREE_SCAN_HERO_CTA}
            source={`${FREE_SCAN_PAGE.signupSource}_hero`}
          />
        </div>
      }
      footer={<FaqSection className="py-0 lg:py-0" content={FREE_SCAN_FAQ} />}
      overviewVisual={<FreeScanTable />}
      stage={<FreeScanStage />}
      title={
        <>
          <span className="text-primary">Free</span> AI visibility scan
        </>
      }
    />
  );
}
