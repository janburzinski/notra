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
import { highlight } from "sugar-high";

import {
  CODE_BLOCK_COPIED_MS,
  CODE_BLOCK_COPY_LABELS,
  CODE_BLOCK_LABELS,
} from "../constants/code-block";
import type {
  CodeBlockCopyButtonProps,
  CodeBlockProps,
  CodeBlockTabsProps,
  CopyStatus,
} from "../types/code-block";

function CodeBlockCopyButton({
  code,
  label,
  onCopy,
}: CodeBlockCopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetRef = useRef(0);

  const copy = async () => {
    window.clearTimeout(resetRef.current);
    try {
      await navigator.clipboard.writeText(code);
      onCopy?.();
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    resetRef.current = window.setTimeout(
      () => setStatus("idle"),
      CODE_BLOCK_COPIED_MS
    );
  };

  return (
    <button
      aria-label={CODE_BLOCK_COPY_LABELS[status](label)}
      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-2 outline-transparent transition-colors"
      onClick={copy}
      type="button"
    >
      <HugeiconsIcon
        className={cn(
          "transition-[opacity,scale] duration-150",
          status !== "idle" && "scale-50 opacity-0"
        )}
        icon={Copy01Icon}
        size={14}
      />
      <HugeiconsIcon
        className={cn(
          "absolute transition-[opacity,scale] duration-150",
          status !== "copied" && "scale-50 opacity-0"
        )}
        icon={Tick02Icon}
        size={14}
      />
      <HugeiconsIcon
        className={cn(
          "text-destructive absolute transition-[opacity,scale] duration-150",
          status !== "failed" && "scale-50 opacity-0"
        )}
        icon={Alert02Icon}
        size={14}
      />
    </button>
  );
}

function CommandBlock({
  code,
  className,
  label = CODE_BLOCK_LABELS.command,
  onCopy,
}: Pick<CodeBlockProps, "code" | "className" | "label" | "onCopy">) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/40 flex h-9 min-w-0 items-center rounded-lg border ps-3 pe-1",
        className
      )}
      data-slot="code-block"
    >
      <input
        aria-label={label}
        className="text-foreground h-full min-w-0 flex-1 cursor-text appearance-none border-0 bg-transparent p-0 font-mono text-xs leading-none shadow-none outline-none"
        onFocus={(event) => event.currentTarget.select()}
        readOnly
        value={code}
      />
      <CodeBlockCopyButton code={code} label={label} onCopy={onCopy} />
    </div>
  );
}

export function CodeBlockTabs({
  label,
  value,
  options,
  onValueChange,
}: CodeBlockTabsProps) {
  return (
    <Tabs.Root
      onValueChange={(next) => {
        const option = options.find((item) => item.value === next);
        if (option) {
          onValueChange(option.value);
        }
      }}
      value={value}
    >
      <Tabs.List
        aria-label={label}
        className="relative flex h-9 items-stretch gap-3.5"
      >
        {options.map((option) => (
          <Tabs.Tab
            className="text-muted-foreground hover:text-foreground data-active:text-foreground focus-visible:outline-ring flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm text-xs whitespace-nowrap outline-2 -outline-offset-2 outline-transparent transition-colors"
            key={option.value}
            value={option.value}
          >
            {option.icon}
            {option.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="bg-foreground absolute bottom-1 left-(--active-tab-left) h-0.5 w-(--active-tab-width) rounded-full transition-[left,width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" />
      </Tabs.List>
    </Tabs.Root>
  );
}

export function CodeBlock({
  code,
  className,
  filename,
  headerEnd,
  tabs,
  variant = "panel",
  label,
  wrap = false,
  onCopy,
}: CodeBlockProps) {
  const html = useMemo(() => highlight(code), [code]);

  if (variant === "command") {
    return (
      <CommandBlock
        className={className}
        code={code}
        label={label}
        onCopy={onCopy}
      />
    );
  }

  return (
    <div
      className={cn(
        "border-shell-border bg-shell min-w-0 rounded-2xl border p-0.5 pt-0",
        className
      )}
      data-slot="code-block"
    >
      <div className="flex h-9 min-w-0 items-center gap-3 ps-2.5 pe-1">
        {tabs ? (
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs}
          </div>
        ) : null}
        {filename ? (
          <p
            className={cn(
              "text-muted-foreground truncate font-mono text-xs",
              tabs ? "shrink-0 pe-2" : "min-w-0 flex-1"
            )}
          >
            {filename}
          </p>
        ) : null}
        {tabs || filename ? null : <span className="min-w-0 flex-1" />}
        {headerEnd}
      </div>
      <div className="group/code border-table-card-border bg-table-card shadow-table-card relative min-w-0 rounded-[14px] border">
        <div className="bg-table-card absolute end-1 top-1 z-10 rounded-lg opacity-0 transition-opacity duration-150 group-hover/code:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <CodeBlockCopyButton
            code={code}
            label={label ?? CODE_BLOCK_LABELS.snippet}
            onCopy={onCopy}
          />
        </div>
        <pre
          className={cn(
            "m-0 overflow-x-auto bg-transparent p-3 pe-10 font-mono text-xs leading-relaxed [scrollbar-width:thin]",
            wrap && "wrap-anywhere whitespace-pre-wrap"
          )}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sugar-high escapes the source before tokenizing
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
