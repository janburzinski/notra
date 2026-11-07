"use client";

import { useState } from "react";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAgentPromptBarVisible } from "@/lib/hooks/use-agent-prompt-bar-visible";
import { usePathname } from "@/lib/navigation";
import { isAutopilotPathname } from "@/utils/dashboard-paths";
import dynamic from "@/utils/lazy-component";

const AutopilotAgentDock = dynamic(
  () =>
    import("@/components/autopilot/autopilot-agent-dock").then(
      (module) => module.AutopilotAgentDock
    ),
  { ssr: false }
);

/** The agent dock at the bottom of the Autopilot pages. */
export function AgentPromptBar() {
  const { activeOrganization } = useOrganizationsContext();
  const pathname = usePathname();
  const onAutopilot = isAutopilotPathname(pathname);
  const visible = useAgentPromptBarVisible();
  // The dock stays mounted after the first visit, so its conversation
  // survives a trip to another page.
  const [dockMounted, setDockMounted] = useState(onAutopilot);
  if (onAutopilot && !dockMounted) {
    setDockMounted(true);
  }

  if (!(dockMounted && activeOrganization)) {
    return null;
  }

  return (
    <AutopilotAgentDock
      hidden={!visible}
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      organizationSlug={activeOrganization.slug}
    />
  );
}
