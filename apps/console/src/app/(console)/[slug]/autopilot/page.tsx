import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutopilotPageClient } from "@/components/autopilot/autopilot-page-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";
import type { AutopilotRouteProps } from "@/types/autopilot";

export const metadata: Metadata = { title: "Autopilot · Notra Console" };

export default async function AutopilotPage({
  params,
  searchParams,
}: AutopilotRouteProps) {
  const [{ slug }, { view }] = await Promise.all([params, searchParams]);
  const { user } = await validateOrganizationAccess(slug);
  if (!hasAdminRole(user.role)) {
    notFound();
  }
  return (
    <AutopilotPageClient
      slug={slug}
      view={view === "runs" ? "runs" : "health"}
    />
  );
}
