import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteDetailClient } from "@/components/sites/site-detail-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "Site · Notra Console",
};

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ slug: string; siteId: string }>;
}) {
  const { slug, siteId } = await params;
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  return <SiteDetailClient siteId={siteId} slug={slug} />;
}
