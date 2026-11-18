import { useTranslations } from "use-intl";

import { LANDING_FAQ_ITEMS } from "@/constants/landing/faq";
import type { FaqContent } from "@/types/landing/faq";

export function useLandingFaqContent(): FaqContent {
  const t = useTranslations("landing.faq");
  return {
    heading: t("heading"),
    subcopy: t("subcopy"),
    items: LANDING_FAQ_ITEMS.map(({ id, defaultOpen }) => ({
      id,
      defaultOpen,
      question: t(`items.${id}.question`),
      answer: t(`items.${id}.answer`),
    })),
  };
}
