import { Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocale } from "use-intl";

import Image from "@/components/framework/image";
import { useIsEmbed } from "@/components/providers/embed-mode-provider";
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
  flagEmoji,
} from "@/utils/country";
import { languageFlagCountry } from "@/utils/web-analytics";

/**
 * Embeds draw the system's own emoji instead of loading Twemoji from a CDN,
 * so visitors on a customer's site make no third-party requests.
 */
function NativeEmoji({
  emoji,
  label,
  className,
}: {
  emoji: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label || undefined}
      className={cn(
        "inline-flex items-center justify-center leading-none",
        className
      )}
      role={label ? "img" : undefined}
    >
      {emoji}
    </span>
  );
}

export function Twemoji({ emoji, label, className }: TwemojiProps) {
  const embed = useIsEmbed();
  const codePoints = emojiCodePoints(emoji);
  if (!codePoints) {
    return null;
  }
  if (embed) {
    return <NativeEmoji className={className} emoji={emoji} label={label} />;
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
  const embed = useIsEmbed();
  const codePoints = countryFlagCodePoints(code);
  if (!codePoints) {
    return null;
  }
  if (embed) {
    return (
      <NativeEmoji
        className={className}
        emoji={flagEmoji(codePoints)}
        label={countryName(code, locale)}
      />
    );
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
  const embed = useIsEmbed();
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
  if (embed) {
    return (
      <NativeEmoji
        className={className}
        emoji={flagEmoji(codePoints)}
        label=""
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
