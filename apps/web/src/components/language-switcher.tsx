import { cn } from "@notra/ui/lib/utils";
import { useLocale, useTranslations } from "use-intl";

import {
  LANDING_FORCE_ENGLISH_PATH,
  LANDING_HOME_PATHS,
  LANDING_LOCALE_LABELS,
  LANDING_LOCALES,
} from "@/constants/i18n";
import { rememberLandingLocale } from "@/utils/landing-locale";

export function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const current = useLocale();

  return (
    <nav aria-label={t("label")} className="flex items-center gap-3">
      {LANDING_LOCALES.map((locale) => (
        <a
          aria-current={locale === current ? "page" : undefined}
          className={cn(
            "font-sans text-[0.8125rem] leading-[1.125rem] font-medium transition-colors",
            locale === current
              ? "dark:text-foreground text-[#1e1e1e]"
              : "dark:text-foreground/50 dark:hover:text-foreground text-[#1e1e1ea6] hover:text-[#1e1e1e]"
          )}
          href={
            locale === "en"
              ? LANDING_FORCE_ENGLISH_PATH
              : LANDING_HOME_PATHS[locale]
          }
          hrefLang={locale}
          key={locale}
          lang={locale}
          onClick={() => rememberLandingLocale(locale)}
        >
          {LANDING_LOCALE_LABELS[locale]}
        </a>
      ))}
    </nav>
  );
}
