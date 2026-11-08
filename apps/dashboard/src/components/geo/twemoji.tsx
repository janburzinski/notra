import { Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocale } from "use-intl";

import Image from "@/components/framework/image";
import { TWEMOJI_FLAG_BASE, TWEMOJI_FLAG_SIZE } from "@/constants/country";
import { cn } from "@/lib/utils";
import type {
  CountryFlagProps,
  LanguageFlagProps,
  TwemojiProps,
} from "@/types/geo";
import {
  countryFlagCodePoints,
  countryName,
  emojiCodePoints,
} from "@/utils/country";
import { languageFlagCountry } from "@/utils/web-analytics";

export function Twemoji({ emoji, label, className }: TwemojiProps) {
  const codePoints = emojiCodePoints(emoji);
  if (!codePoints) {
    return null;
  }

  return (
    <Image
      alt={label}
      className={className}
      height={TWEMOJI_FLAG_SIZE}
      src={`${TWEMOJI_FLAG_BASE}/${codePoints}.svg`}
      unoptimized
      width={TWEMOJI_FLAG_SIZE}
    />
  );
}

export function CountryFlag({ code, className }: CountryFlagProps) {
  const locale = useLocale();
  const codePoints = countryFlagCodePoints(code);
  if (!codePoints) {
    return null;
  }

  return (
    <Image
      alt={countryName(code, locale)}
      className={className}
      height={TWEMOJI_FLAG_SIZE}
      src={`${TWEMOJI_FLAG_BASE}/${codePoints}.svg`}
      unoptimized
      width={TWEMOJI_FLAG_SIZE}
    />
  );
}

/** The flag of a language's country of origin, or a globe when none is listed. */
export function LanguageFlag({ language, className }: LanguageFlagProps) {
  const country = languageFlagCountry(language);
  const codePoints = country ? countryFlagCodePoints(country) : null;
  if (!codePoints) {
    return (
      <HugeiconsIcon
        aria-hidden="true"
        className={cn("text-muted-foreground", className)}
        icon={Globe02Icon}
      />
    );
  }

  return (
    <Image
      alt=""
      className={className}
      height={TWEMOJI_FLAG_SIZE}
      src={`${TWEMOJI_FLAG_BASE}/${codePoints}.svg`}
      unoptimized
      width={TWEMOJI_FLAG_SIZE}
    />
  );
}
