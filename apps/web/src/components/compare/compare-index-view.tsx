import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { useTranslations } from "use-intl";

import { CompareCard } from "@/components/compare/compare-card";
import { CompareHeroDuel } from "@/components/compare/compare-hero-duel";
import { CtaBanner } from "@/components/landing/cta-banner";
import { MarketingHeroWash } from "@/components/marketing-hero-wash";
import { TrackedSignupLink } from "@/components/tracked-signup-link";
import {
  COMPARE_DISCLAIMER,
  COMPARE_INDEX_SUBTITLE,
  COMPARE_SIGNUP_SOURCE,
} from "@/constants/compare/page";
import type { CompareIndexViewProps } from "@/types/compare";

export function CompareIndexView({ competitors }: CompareIndexViewProps) {
  const ctaT = useTranslations("landing.cta");
  return (
    <div className="flex w-full flex-col items-center gap-16 pb-14 antialiased [font-synthesis:none] lg:gap-20">
      <MarketingHeroWash
        backdrop={<CompareHeroDuel />}
        subtitle={COMPARE_INDEX_SUBTITLE}
        title="Notra vs the rest"
      >
        <CtaButton
          nativeButton={false}
          render={
            <TrackedSignupLink source={`${COMPARE_SIGNUP_SOURCE}_index_hero`} />
          }
          size="lg"
          variant="primary"
        >
          {ctaT("primary")}
        </CtaButton>
      </MarketingHeroWash>

      <section className="flex w-[min(100%-3rem,72rem)] flex-col gap-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((competitor) => (
            <CompareCard competitor={competitor} key={competitor.slug} />
          ))}
        </div>
        <p className="font-sans text-[0.8125rem] leading-5 text-[#1E1E1E80] dark:text-white/45">
          {COMPARE_DISCLAIMER}
        </p>
      </section>

      <section className="w-full px-6">
        <CtaBanner signupSource={`${COMPARE_SIGNUP_SOURCE}_index_cta`} />
      </section>
    </div>
  );
}
