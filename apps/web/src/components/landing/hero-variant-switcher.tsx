import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";

import {
  HERO_CONTROL_VARIANT,
  HERO_PREVIEW_VARIANT_PARAM,
  HERO_VARIANTS,
} from "@/constants/landing/hero";

export function HeroVariantSwitcher() {
  const [preview, setPreview] = useQueryState(
    HERO_PREVIEW_VARIANT_PARAM,
    parseAsString
  );
  const [dismissed, setDismissed] = useState(false);
  const active = preview ?? HERO_CONTROL_VARIANT;

  if (dismissed) {
    return null;
  }

  return (
    <nav
      aria-label="Hero variant preview"
      className="bg-background/90 fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 text-sm shadow-sm backdrop-blur"
    >
      {Object.keys(HERO_VARIANTS).map((key) => (
        <button
          aria-pressed={active === key}
          className="aria-pressed:bg-foreground aria-pressed:text-background rounded-full px-3 py-1"
          key={key}
          onClick={() => setPreview(key)}
          type="button"
        >
          {key}
        </button>
      ))}
      <button
        aria-label="Hide variant switcher"
        className="text-muted-foreground hover:text-foreground hover:bg-muted ml-0.5 flex size-7 items-center justify-center rounded-full transition-colors"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <HugeiconsIcon className="size-3.5" icon={Cancel01Icon} />
      </button>
    </nav>
  );
}
