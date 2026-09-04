import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";

import { MarketingHeroWash } from "@/components/marketing-hero-wash";
import { PrMergeVideoPreview } from "@/components/pr-merge-video/pr-merge-video-preview";
import { RepoInputForm } from "@/components/star-video/repo-input-form";
import { buildBreadcrumbJsonLd, serializeJsonLd } from "@/utils/jsonld";
import { DEFAULT_SOCIAL_IMAGE, TWITTER_HANDLE } from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const title = "GitHub PR Merge Video Generator";
const description =
  "Turn a GitHub repository's recent pull request merges into an animated people leaderboard. Free, no sign-up.";
const url = `${SITE_URL}/pr-merge-video`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: {
    title,
    description,
    url,
    type: "website",
    siteName: "Notra",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [DEFAULT_SOCIAL_IMAGE.url],
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
  },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Home", url: SITE_URL },
  { name: "GitHub PR Merge Video Generator", url },
]);

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GitHub PR Merge Video Generator",
  url,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function PrMergeVideoPage() {
  return (
    <div className="flex w-full flex-col items-center">
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: server-built JSON-LD
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: server-built JSON-LD
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }}
        type="application/ld+json"
      />

      <NuqsAdapter>
        <section className="flex w-full flex-col items-center gap-10 pb-16 antialiased [font-synthesis:none] md:gap-12 md:pb-24">
          <MarketingHeroWash
            subtitle="See who shipped the most pull requests. Pick a repo and time range, choose the people, then download a share-ready bubble video."
            title={
              <>
                GitHub PR <span className="text-primary">Merge</span> Video
                Generator
              </>
            }
          >
            <Suspense fallback={null}>
              <RepoInputForm
                actionLabel="Analyze merges"
                tool="pr-merge-video"
              />
            </Suspense>
          </MarketingHeroWash>

          <Suspense fallback={null}>
            <PrMergeVideoPreview />
          </Suspense>
        </section>
      </NuqsAdapter>
    </div>
  );
}
