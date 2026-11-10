import { CommandLineIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CommandTabs } from "@notra/ui/components/ui/command-tabs";
import { ExpandableTabs } from "@notra/ui/components/ui/expandable-tabs";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";

import { MCP_CLIENTS } from "@/constants/mcp";
import type { McpClient, McpCommandTabsProps } from "@/types/mcp";

function clientIcon(client: McpClient) {
  if (!client.iconSrc) {
    return (
      <HugeiconsIcon
        className="text-foreground size-4 shrink-0"
        icon={CommandLineIcon}
      />
    );
  }
  return (
    <img
      decoding="async"
      loading="lazy"
      alt={`${client.label} logo`}
      className={cn("size-4 shrink-0", client.invertInDark && "dark:invert")}
      height={16}
      src={client.iconSrc}
      width={16}
    />
  );
}

/**
 * The hero sits on a dither, so both bars get a solid surface instead of the shared see-through muted
 * one, and the copy button is a plain dark (light mode) or white (dark mode) button.
 */
const SURFACE_CLASSNAME =
  "border-[#E4DCF5] bg-white shadow-[0_1px_2px_rgba(30,30,30,0.05)] dark:border-white/12 dark:bg-[#1A1429]";

const COMMAND_CLASSNAME = cn(
  "[&>div:first-child]:border-[#E4DCF5] [&>div:first-child]:bg-white [&>div:first-child]:shadow-[0_1px_2px_rgba(30,30,30,0.05)] dark:[&>div:first-child]:border-white/12 dark:[&>div:first-child]:bg-[#1A1429]",
  "[&_code]:text-[#1E1E1E] dark:[&_code]:text-white",
  "[&_[data-slot=button]]:border-transparent [&_[data-slot=button]]:bg-[#1E1E1E] [&_[data-slot=button]]:text-white [&_[data-slot=button]]:shadow-none dark:[&_[data-slot=button]]:bg-white dark:[&_[data-slot=button]]:text-[#1E1E1E] [&_[data-slot=button]:hover]:bg-[#1E1E1E]/85 dark:[&_[data-slot=button]:hover]:bg-white/85"
);

const CLIENT_ITEMS = MCP_CLIENTS.map((client) => ({
  value: client.id,
  label: client.label,
  command: client.command,
  icon: clientIcon(client),
}));

export function McpCommandTabs({ className }: McpCommandTabsProps) {
  const [activeClientId, setActiveClientId] = useState<string | undefined>(
    MCP_CLIENTS[0]?.id
  );

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <CommandTabs
        className={COMMAND_CLASSNAME}
        highlight
        items={CLIENT_ITEMS}
        onValueChange={setActiveClientId}
        tabsPosition="none"
        value={activeClientId}
      />
      <ExpandableTabs
        className={cn("-mt-px rounded-t-none border-t-0", SURFACE_CLASSNAME)}
        items={CLIENT_ITEMS}
        label="Choose an MCP client"
        onValueChange={setActiveClientId}
        value={activeClientId}
      />
    </div>
  );
}
