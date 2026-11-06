import { Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { publicWebsiteHostname } from "@notra/geo-core/schemas/url";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { cn } from "@notra/ui/lib/utils";
import { parseAsString, useQueryState } from "nuqs";
import { type FormEvent, useState } from "react";

import { AUTH_SIGNUP_URL } from "@/constants/auth";
import {
  HERO_SIGNUP_SOURCE,
  HERO_WEBSITE_INVALID_MESSAGE,
  HERO_WEBSITE_MAX_LENGTH,
  HERO_WEBSITE_PARAM,
  HERO_WEBSITE_PLACEHOLDER,
} from "@/constants/landing/hero";
import type { HeroWebsiteFormProps } from "@/types/landing/hero";
import { startSignup } from "@/utils/signup";

export function HeroWebsiteForm({ cta, onSubmit }: HeroWebsiteFormProps) {
  const [website, setWebsite] = useQueryState(
    HERO_WEBSITE_PARAM,
    parseAsString.withDefault("").withOptions({ history: "replace" })
  );
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = website.slice(0, HERO_WEBSITE_MAX_LENGTH).trim();
    const hostname = value ? publicWebsiteHostname(value) : null;
    if (value && !hostname) {
      setInvalid(true);
      return;
    }
    onSubmit();
    const href = new URL(AUTH_SIGNUP_URL);
    if (hostname) {
      href.searchParams.set(HERO_WEBSITE_PARAM, hostname);
    }
    startSignup(HERO_SIGNUP_SOURCE, href.toString());
  }

  return (
    <form
      className="relative flex w-full max-w-[28rem] flex-col items-center"
      noValidate
      onSubmit={handleSubmit}
    >
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-full border border-black/10 bg-white p-1.5 pl-4 dark:border-white/10 dark:bg-[#1e1a29]",
          invalid && "border-red-500/60 dark:border-red-400/60"
        )}
      >
        <HugeiconsIcon
          aria-hidden
          className="size-5 shrink-0 text-[#1E1E1E80] dark:text-white/50"
          icon={Globe02Icon}
        />
        <input
          aria-describedby={invalid ? "hero-website-error" : undefined}
          aria-invalid={invalid || undefined}
          aria-label="Your website"
          autoCapitalize="none"
          autoComplete="url"
          className="min-w-0 flex-1 bg-transparent font-sans text-base text-[#1E1E1E] outline-none placeholder:text-[#1E1E1E80] dark:text-white dark:placeholder:text-white/50"
          inputMode="url"
          maxLength={HERO_WEBSITE_MAX_LENGTH}
          onChange={(event) => {
            setInvalid(false);
            setWebsite(event.target.value || null);
          }}
          placeholder={HERO_WEBSITE_PLACEHOLDER}
          spellCheck={false}
          type="text"
          value={website}
        />
        <CtaButton
          className="font-display h-auto rounded-full px-4 py-2.5 text-base leading-[1.14] font-medium tracking-[-0.015em] sm:px-5"
          type="submit"
          variant="primary"
        >
          {cta}
        </CtaButton>
      </div>
      {invalid ? (
        <p
          className="absolute top-full mt-2 font-sans text-sm text-red-600 dark:text-red-400"
          id="hero-website-error"
          role="alert"
        >
          {HERO_WEBSITE_INVALID_MESSAGE}
        </p>
      ) : null}
    </form>
  );
}
