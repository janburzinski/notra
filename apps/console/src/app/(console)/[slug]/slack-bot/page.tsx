import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SlackBotClient } from "@/components/slack-bot/slack-bot-client";
import { validateOrganizationAccess } from "@/lib/auth/actions";
import { hasAdminRole } from "@/lib/auth/role";

export const metadata: Metadata = {
  title: "Slack Bot · Notra Console",
};

export default async function SlackBotPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await validateOrganizationAccess(slug);

  if (!hasAdminRole(user.role)) {
    notFound();
  }

  return <SlackBotClient />;
}
