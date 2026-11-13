"use client";

import { Tabs } from "@base-ui/react/tabs";
import {
  Alert02Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { useMemo, useRef, useState } from "react";

import {
  PACKAGE_COMMAND_COPIED_MS,
  PACKAGE_COMMAND_COPY_LABELS,
  PACKAGE_MANAGERS,
} from "../constants/package-command";
import { usePackageManager } from "../hooks/use-package-manager";
import {
  convertNpmCommand,
  toPackageManager,
  writePackageManager,
} from "../lib/package-command";
import type { CopyStatus, PackageCommandProps } from "../types/package-command";
import { PackageManagerIcon } from "./package-manager-icon";

function CopyCommandButton({ text }: { text: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetRef = useRef(0);

  const copy = async () => {
    window.clearTimeout(resetRef.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    resetRef.current = window.setTimeout(
      () => setStatus("idle"),
      PACKAGE_COMMAND_COPIED_MS
    );
  };

  return (
    <button
      aria-label={PACKAGE_COMMAND_COPY_LABELS[status]}
      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] outline-2 outline-transparent transition-colors"
      onClick={copy}
      type="button"
    >
      <HugeiconsIcon
        className={cn(
          "transition-[opacity,scale] duration-150",
          status !== "idle" && "scale-50 opacity-0"
        )}
        icon={Copy01Icon}
        size={15}
      />
      <HugeiconsIcon
        className={cn(
          "absolute transition-[opacity,scale] duration-150",
          status !== "copied" && "scale-50 opacity-0"
        )}
        icon={Tick02Icon}
        size={15}
      />
      <HugeiconsIcon
        className={cn(
          "text-destructive absolute transition-[opacity,scale] duration-150",
          status !== "failed" && "scale-50 opacity-0"
        )}
        icon={Alert02Icon}
        size={15}
      />
    </button>
  );
}

export function PackageCommand({ command, className }: PackageCommandProps) {
  const manager = usePackageManager();
  const commands = useMemo(() => convertNpmCommand(command), [command]);

  return (
    <Tabs.Root
      className={cn(
        "border-shell-border bg-shell w-full min-w-0 rounded-2xl border p-0.5 pt-0",
        className
      )}
      data-slot="package-command"
      onValueChange={(value) => {
        const next = toPackageManager(value);
        if (next) {
          writePackageManager(next);
        }
      }}
      value={manager}
    >
      <Tabs.List
        aria-label="Package manager"
        className="relative flex h-9 [scrollbar-width:none] items-stretch gap-3.5 overflow-x-auto px-3 [&::-webkit-scrollbar]:hidden"
      >
        {PACKAGE_MANAGERS.map((item) => (
          <Tabs.Tab
            className="text-muted-foreground hover:text-foreground data-active:text-foreground focus-visible:outline-ring flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm font-mono text-xs outline-2 -outline-offset-2 outline-transparent transition-colors"
            key={item}
            value={item}
          >
            <PackageManagerIcon manager={item} />
            {item}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="bg-foreground absolute bottom-1 left-(--active-tab-left) h-0.5 w-(--active-tab-width) rounded-full transition-[left,width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" />
      </Tabs.List>
      {PACKAGE_MANAGERS.map((item) => (
        <Tabs.Panel
          className="border-table-card-border bg-table-card shadow-table-card flex h-11 min-w-0 items-center gap-2 rounded-[14px] border ps-3.5 pe-1.5 outline-none"
          key={item}
          value={item}
        >
          <code className="min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto mask-[linear-gradient(to_right,black_calc(100%-1rem),transparent)] font-mono text-[0.8125rem] whitespace-nowrap [&::-webkit-scrollbar]:hidden">
            <span className="text-muted-foreground select-none">$ </span>
            {commands[item]}
            <span className="inline-block w-4" />
          </code>
          <CopyCommandButton text={commands[item]} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
