import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OverviewClient } from "@/components/overview/overview-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "Overview · Notra Console",
};

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    redirect(`/${slug}/integrations`);
  }

  return <OverviewClient />;
}
