import { createFileRoute } from "@tanstack/react-router";

import { DataView } from "@/components/data/data-view";
import {
  DATA_CACHE_CONTROL,
  DATA_DESCRIPTION,
  DATA_JSON_URL,
  DATA_TITLE,
  DATA_URL,
} from "@/constants/data";
import { getDataPage } from "@/lib/data/functions";
import { buildHead } from "@/utils/head";
import { buildBreadcrumbJsonLd, serializeJsonLd } from "@/utils/jsonld";
import { DEFAULT_SOCIAL_IMAGE, TWITTER_HANDLE } from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Home", url: SITE_URL },
  { name: DATA_TITLE, url: DATA_URL },
]);

export const Route = createFileRoute("/_site/data/")({
  loader: () => getDataPage(),
  head: () =>
    buildHead({
      title: DATA_TITLE,
      description: DATA_DESCRIPTION,
      alternates: { canonical: DATA_URL },
      openGraph: {
        title: DATA_TITLE,
        description: DATA_DESCRIPTION,
        url: DATA_URL,
        type: "website",
        siteName: "Notra",
        images: [DEFAULT_SOCIAL_IMAGE],
      },
      twitter: {
        card: "summary_large_image",
        title: DATA_TITLE,
        description: DATA_DESCRIPTION,
        images: [DEFAULT_SOCIAL_IMAGE.url],
        site: TWITTER_HANDLE,
        creator: TWITTER_HANDLE,
      },
    }),
  // A "not ready yet" page must not stick in shared caches for an hour.
  headers: ({ loaderData }) => ({
    "Cache-Control": loaderData ? DATA_CACHE_CONTROL : "no-store",
  }),
  component: DataPage,
});

function DataPage() {
  const page = Route.useLoaderData();
  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Notra ${DATA_TITLE}`,
    description: DATA_DESCRIPTION,
    url: DATA_URL,
    creator: { "@type": "Organization", name: "Notra", url: SITE_URL },
    isAccessibleForFree: true,
    ...(page
      ? {
          dateModified: page.generatedAt,
          temporalCoverage: `${page.windowFrom}/${page.day}`,
        }
      : {}),
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: DATA_JSON_URL,
      },
    ],
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(datasetJsonLd) }}
        type="application/ld+json"
      />
      <DataView page={page} />
    </>
  );
}
