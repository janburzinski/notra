"use client";

import { useLocation } from "@tanstack/react-router";

import {
  SiteDeploymentSkeleton,
  SiteDesignSkeleton,
  SiteSectionSkeleton,
} from "@/components/sites/site-page-skeleton";
import { SitesPageShell } from "@/components/sites/sites-page-shell";

export function SitePageSkeleton() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [, , , , section, deploymentId] = pathname.split("/");
  let body = <SiteSectionSkeleton />;
  if (section === "design") {
    body = <SiteDesignSkeleton />;
  } else if (section === "deployments" && deploymentId) {
    body = <SiteDeploymentSkeleton />;
  }
  return <SitesPageShell>{body}</SitesPageShell>;
}
