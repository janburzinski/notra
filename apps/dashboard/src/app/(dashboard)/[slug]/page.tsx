import type { Metadata } from "next";
import { Suspense } from "react";

import PageClient from "./page-client";
import { DashboardPageSkeleton } from "./skeleton";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function Page({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <PageClient organizationSlug={slug} />
    </Suspense>
  );
}
export default Page;
