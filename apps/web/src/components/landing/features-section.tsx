import { useTranslations } from "use-intl";

import { FeaturesCard } from "./features-card";
import { FeaturesCardEngines } from "./features-card-engines";
import { FeaturesCardGaps } from "./features-card-gaps";
import { FeaturesCardShare } from "./features-card-share";
import { FeaturesCardTraffic } from "./features-card-traffic";

export function FeaturesSection() {
  const t = useTranslations("landing.features");
  return (
    <section className="mx-auto flex w-full max-w-360 flex-col items-center px-6 pt-16 antialiased [font-synthesis:none] sm:px-12 sm:pt-20 lg:px-20 lg:pt-35">
      <div className="flex w-full flex-col items-center gap-10 sm:gap-13.5">
        <header className="flex flex-col items-center gap-3 sm:gap-4">
          <h2 className="font-display text-center text-[2rem] leading-[1.15] font-medium tracking-[-0.02em] text-black sm:text-[2.25rem] lg:text-[3.0625rem]/14 dark:text-white">
            {t("heading")}
          </h2>
          <p className="font-display w-full max-w-206.25 text-center text-base/6 font-medium tracking-[-0.01em] text-balance text-[#1E1E1EBF] sm:text-xl/7.5 dark:text-white/70">
            {t("subcopyLineOne")} <br className="max-sm:hidden" />
            {t("subcopyLineTwo")}
          </p>
        </header>
        <div className="grid w-full grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-2">
          <FeaturesCard
            copy={{
              title: t("cards.engines.title"),
              description: t("cards.engines.description"),
            }}
          >
            <FeaturesCardEngines />
          </FeaturesCard>
          <FeaturesCard
            copy={{
              title: t("cards.share.title"),
              description: t("cards.share.description"),
            }}
            footnote={t("share.footnote")}
          >
            <FeaturesCardShare />
          </FeaturesCard>
          <FeaturesCard
            copy={{
              title: t("cards.traffic.title"),
              description: t("cards.traffic.description"),
            }}
          >
            <FeaturesCardTraffic />
          </FeaturesCard>
          <FeaturesCard
            copy={{
              title: t("cards.gaps.title"),
              description: t("cards.gaps.description"),
            }}
          >
            <FeaturesCardGaps />
          </FeaturesCard>
        </div>
      </div>
    </section>
  );
}
