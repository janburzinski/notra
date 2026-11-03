import { useCallback } from "react";
import { useTranslations } from "use-intl";

import { isSupportedLanguage } from "@/utils/languages";

export function useLanguageLabel() {
  const t = useTranslations("common.languages");
  return useCallback(
    <Language extends string>(language: Language): string => {
      const value: string = language;
      return isSupportedLanguage(value) ? t(value) : value;
    },
    [t]
  );
}
