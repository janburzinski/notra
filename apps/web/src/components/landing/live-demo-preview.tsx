import { useTranslations } from "use-intl";

import {
  LIVE_DEMO_PREVIEW_DARK_SRC,
  LIVE_DEMO_PREVIEW_SRC,
} from "@/constants/landing/live-demo";

export function LiveDemoPreview() {
  const t = useTranslations("landing.hero");
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet={LIVE_DEMO_PREVIEW_DARK_SRC}
        type="image/webp"
      />
      <img
        decoding="async"
        alt={t("demoPreviewAlt")}
        className="pointer-events-none absolute top-0 left-0 h-auto w-[320%] max-w-none -translate-x-[19%] -translate-y-[7%] sm:inset-0 sm:size-full sm:translate-0 sm:object-cover sm:object-top-left"
        fetchPriority="high"
        height={1250}
        src={LIVE_DEMO_PREVIEW_SRC}
        width={2000}
      />
    </picture>
  );
}
