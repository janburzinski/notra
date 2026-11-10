import { Cloudflare } from "@notra/ui/components/ui/svgs/cloudflare";
import { Databuddy } from "@notra/ui/components/ui/svgs/databuddy";
import { Plausible } from "@notra/ui/components/ui/svgs/plausible";
import { Rybbit } from "@notra/ui/components/ui/svgs/rybbit";
import { Vercel } from "@notra/ui/components/ui/svgs/vercel";

import { cn } from "@/lib/utils";
import type { ImportProviderMarkProps } from "@/types/components/analytics-import";

const LOGOS = {
  plausible: { Logo: Plausible, size: "h-4 w-auto" },
  plausible_csv: { Logo: Plausible, size: "h-4 w-auto" },
  cloudflare: { Logo: Cloudflare, size: "h-auto w-5" },
  cloudflare_rum: { Logo: Cloudflare, size: "h-auto w-5" },
  vercel: { Logo: Vercel, size: "size-3.5" },
  rybbit: { Logo: Rybbit, size: "h-auto w-5" },
  databuddy: { Logo: Databuddy, size: "size-4" },
};

/** The provider's logo alone; `className` replaces its default size. */
export function ImportProviderLogo({
  provider,
  className,
}: ImportProviderMarkProps) {
  const { Logo, size } = LOGOS[provider];
  return <Logo aria-hidden="true" className={className ?? size} />;
}

/** The logo in a fixed slot, so rows line up; `className` can frame it. */
export function ImportProviderMark({
  provider,
  className,
}: ImportProviderMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center",
        className
      )}
    >
      <ImportProviderLogo provider={provider} />
    </span>
  );
}
