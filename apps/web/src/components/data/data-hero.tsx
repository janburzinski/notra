import { CompetitorLogo } from "@notra/ui/components/geo/competitor-logo";
import { cn } from "@notra/ui/lib/utils";

import { MarketingHeroWash } from "@/components/marketing-hero-wash";
import type { DataPageModel } from "@/types/data";
import { vendorDomain } from "@/utils/data";

const HERO_LOGOS = 6;

/** Companies behind the busiest bots and assistants, most traffic first. */
function heroCompanies(page: DataPageModel | null): string[] {
  if (!page) {
    return [];
  }
  const seen = new Set<string>();
  for (const row of [...page.crawlers, ...page.assistants]) {
    if (row.vendor && vendorDomain(row.vendor)) {
      seen.add(row.vendor);
    }
  }
  return [...seen].slice(0, HERO_LOGOS);
}

function LogoStack({ vendors }: { vendors: string[] }) {
  return (
    <span
      aria-label={vendors.join(", ")}
      className="mx-1.5 inline-flex translate-y-[0.2em] items-center"
      role="img"
    >
      {vendors.map((vendor, index) => (
        // The ring is the hero's wash, so each logo cuts cleanly into the next.
        <span
          className={cn(
            "relative inline-flex size-[1.65em] items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] ring-[0.12em] ring-[#F1ECFB] dark:bg-[#1f1a2e] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] dark:ring-[#2a2140]",
            index > 0 && "-ml-[0.22em]"
          )}
          key={vendor}
          style={{ zIndex: vendors.length - index }}
        >
          <CompetitorLogo
            className="size-[0.95em] rounded-[0.2em]"
            domain={vendorDomain(vendor)}
            name={vendor}
          />
        </span>
      ))}
    </span>
  );
}

export function DataHero({ page }: { page: DataPageModel | null }) {
  const vendors = heroCompanies(page);
  return (
    <MarketingHeroWash
      subtitle={
        <>
          Every day, we count which AI bots
          {vendors.length > 0 ? <LogoStack vendors={vendors} /> : " "}
          read the sites that use Notra, and which assistants send people back.
        </>
      }
      title={
        <>
          How <span className="text-primary">AI</span> reads the web
        </>
      }
    />
  );
}
