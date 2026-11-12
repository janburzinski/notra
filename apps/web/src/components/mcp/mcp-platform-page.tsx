import { track } from "@databuddy/sdk/react";
import {
  ArrowRight02Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ctaButtonVariants } from "@notra/ui/components/shared/cta-button";
import { cn } from "@notra/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { HeroDither } from "@/components/landing/hero-dither";
import { McpCommandTabs } from "@/components/mcp/mcp-command-tabs";
import { McpUseCasesCallout } from "@/components/mcp/mcp-use-cases-callout";
import {
  MCP_PLATFORM_PROMPT_COPIED_EVENT,
  MCP_PLATFORM_VARIANTS,
  MCP_PLATFORMS,
} from "@/constants/mcp-platforms";
import type {
  McpPlatformIconProps,
  McpPlatformPageProps,
  McpPlatformPromptProps,
  McpPlatformStepsProps,
} from "@/types/mcp-platforms";
import { copyToClipboard } from "@/utils/copy-to-clipboard";
import {
  getMcpPlatformCommands,
  getMcpPlatformFlagKey,
} from "@/utils/mcp-platforms";
import { MCP_URL } from "@/utils/urls";

const COPIED_STATE_DURATION_MS = 2000;

const H2_CLASSNAME =
  "font-display text-[1.75rem] leading-[1.2] font-medium tracking-[-0.015em] text-[#1E1E1E] dark:text-white";
const LEAD_CLASSNAME =
  "font-sans text-[0.9375rem] leading-[1.5] text-[#1E1E1EBF] dark:text-white/70";
const PILL_CLASSNAME =
  "flex items-center gap-2 rounded-full border border-[#ECECEC] px-4 py-2 font-sans text-[0.9375rem] font-medium text-[#1E1E1E] transition-colors hover:bg-[#FAFAFA] dark:border-white/10 dark:text-white dark:hover:bg-white/[0.06]";

function McpPlatformIcon({ platform, className }: McpPlatformIconProps) {
  return (
    <img
      alt={platform.wideIcon ? platform.name : ""}
      className={cn(
        "inline-block shrink-0 object-contain",
        platform.wideIcon ? "h-[0.8em] w-auto" : "size-[0.8em]",
        platform.invertInDark && "dark:invert",
        className
      )}
      decoding="async"
      src={platform.iconSrc}
    />
  );
}

function McpPlatformSteps({ platform }: McpPlatformStepsProps) {
  const facts = [
    { term: "Server URL", value: MCP_URL },
    { term: "Sign-in", value: "OAuth through Notra, no API key needed" },
    { term: "You need", value: platform.requirements },
    { term: "Steps", value: `${platform.steps.length}, about 2 minutes` },
  ];

  return (
    <section aria-labelledby="setup" className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className={H2_CLASSNAME} id="setup">
          How to connect Notra to {platform.name}
        </h2>
        <p className={LEAD_CLASSNAME}>{platform.description}</p>
      </div>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[1.25rem] border border-[#ECECEC] bg-[#ECECEC] sm:grid-cols-2 dark:border-white/10 dark:bg-white/10">
        {facts.map((fact) => (
          <div
            className="flex flex-col gap-1 bg-white px-5 py-4 dark:bg-[#161618]"
            key={fact.term}
          >
            <dt className="font-sans text-[0.8125rem] font-medium text-[#1E1E1E80] dark:text-white/50">
              {fact.term}
            </dt>
            <dd className="font-sans text-[0.9375rem] leading-[1.45] text-[#1E1E1E] dark:text-white">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <ol className="flex flex-col">
        {platform.steps.map((step, index) => {
          const number = index + 1;
          const isLast = number === platform.steps.length;
          return (
            <li
              className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-5"
              id={`step-${number}`}
              key={step.title}
            >
              <div className="flex flex-col items-center">
                <span className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold text-white">
                  {number}
                </span>
                {isLast ? null : (
                  <span
                    aria-hidden="true"
                    className="bg-primary/20 w-px flex-1"
                  />
                )}
              </div>
              <div
                className={cn(
                  "grid gap-5 pb-12",
                  step.screenshot &&
                    "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8",
                  isLast && "pb-0"
                )}
              >
                <div className="flex flex-col gap-2">
                  <p className="text-primary font-sans text-[0.8125rem] leading-8 font-semibold tracking-[0.02em] uppercase">
                    Step {number}
                  </p>
                  <h3 className="font-sans text-[1.25rem] leading-[1.3] font-semibold tracking-[-0.01em] text-[#1E1E1E] dark:text-white">
                    {step.title}
                  </h3>
                  <p className="font-sans text-[0.9375rem] leading-[1.6] text-[#1E1E1EBF] dark:text-white/70">
                    {step.body}
                  </p>
                  {step.code ? (
                    <pre className="mt-1 overflow-x-auto rounded-xl bg-[#F1F1F3] px-4 py-3 font-mono text-[0.8125rem] leading-[1.6] text-[#1E1E1E] dark:bg-white/[0.06] dark:text-white">
                      <code>{step.code}</code>
                    </pre>
                  ) : null}
                </div>
                {step.screenshot ? (
                  <figure className="flex flex-col gap-2">
                    <div className="overflow-hidden rounded-xl border border-[#ECECEC] dark:border-white/10">
                      <img
                        alt={step.screenshot.alt}
                        className="block w-full dark:hidden"
                        decoding="async"
                        loading="lazy"
                        src={step.screenshot.light}
                      />
                      <img
                        alt={step.screenshot.alt}
                        className="hidden w-full dark:block"
                        decoding="async"
                        loading="lazy"
                        src={step.screenshot.dark}
                      />
                    </div>
                    <figcaption className="font-sans text-[0.8125rem] leading-[1.45] text-[#1E1E1E80] dark:text-white/50">
                      {step.screenshot.alt}
                    </figcaption>
                  </figure>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function McpPlatformPrompt({
  prompt,
  platform,
  variant,
}: McpPlatformPromptProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!(await copyToClipboard(prompt, "Prompt copied"))) {
      return;
    }
    track(MCP_PLATFORM_PROMPT_COPIED_EVENT, {
      flag_key: getMcpPlatformFlagKey(platform.id),
      platform: platform.id,
      variant,
    });
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_STATE_DURATION_MS);
  }

  return (
    <section
      aria-labelledby="first-prompt"
      className="flex w-full flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className={H2_CLASSNAME} id="first-prompt">
          Your first prompt
        </h2>
        <p className={LEAD_CLASSNAME}>
          Once Notra is connected, paste this into {platform.name}.
        </p>
      </div>
      <div className="flex w-full flex-col rounded-[1.25rem] bg-[#F1F1F3] p-1 dark:bg-white/[0.06]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="font-sans text-[0.9375rem] font-semibold tracking-[-0.01em] text-[#1E1E1E] dark:text-white">
            Prompt
          </span>
          <button
            aria-label={copied ? "Prompt copied" : "Copy prompt"}
            className="focus-visible:ring-primary flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3.5 py-1.75 font-sans text-[0.8125rem] leading-[1.23] font-medium text-[#1E1E1E] [box-shadow:#E4E4E7_0_0_0_0.0625rem] transition-transform duration-75 ease-out outline-none hover:bg-[#FAFAFA] focus-visible:ring-2 active:scale-[0.98] dark:bg-white/[0.08] dark:text-white dark:[box-shadow:#FFFFFF1F_0_0_0_0.0625rem] dark:hover:bg-white/[0.12]"
            onClick={handleCopy}
            type="button"
          >
            <HugeiconsIcon
              className="size-3.5"
              icon={copied ? Tick02Icon : Copy01Icon}
            />
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
        <p className="rounded-[1rem] bg-white px-5 py-5 font-sans text-[1.0625rem] leading-[1.6] tracking-[-0.005em] text-[#1E1E1E] [box-shadow:#E4E4E7_0_0_0_0.0625rem] sm:px-6 sm:py-6 dark:bg-[#161618] dark:text-white/90 dark:[box-shadow:#FFFFFF14_0_0_0_0.0625rem]">
          {prompt}
        </p>
      </div>
    </section>
  );
}

export function McpPlatformPage({ platform, variant }: McpPlatformPageProps) {
  const copy = MCP_PLATFORM_VARIANTS[variant];
  const others = MCP_PLATFORMS.filter((entry) => entry.id !== platform.id);

  return (
    <div className="flex w-full flex-col items-center gap-8 pb-14 antialiased [font-synthesis:none]">
      <section className="w-full px-6 pt-6">
        <div className="relative isolate overflow-clip rounded-3xl bg-[#EFEAFA] dark:bg-[#2a2140]">
          <div className="pointer-events-none absolute inset-0 overflow-clip rounded-3xl">
            <HeroDither />
          </div>
          <div className="relative flex w-full flex-col items-center px-6 pt-20 pb-20 lg:pt-24">
            <div className="flex w-full max-w-[45rem] flex-col items-center gap-10">
              <div className="flex flex-col items-center gap-6">
                <h1 className="font-display max-w-[51.25rem] text-center text-[2.5rem] leading-[1.12] font-medium tracking-[-0.015em] text-balance text-[#1E1E1E] sm:text-[3.25rem] lg:text-[4rem] dark:text-white">
                  Turn{" "}
                  <span className="inline-flex items-baseline gap-[0.18em] whitespace-nowrap">
                    <McpPlatformIcon
                      className="translate-y-[0.08em] self-center"
                      platform={platform}
                    />
                    {platform.wideIcon ? null : platform.name}
                  </span>{" "}
                  into your <span className="text-primary">{copy.role}</span>.
                </h1>
                <p className="max-w-[38.75rem] text-center font-sans text-[1.0625rem] leading-[1.42] font-medium tracking-[-0.005em] text-pretty text-[#1E1E1EBF] sm:text-[1.1875rem] dark:text-white/70">
                  {copy.subhead}
                </p>
              </div>
              <div className="flex w-full flex-col items-center gap-4">
                {platform.listing ? (
                  <a
                    className={cn(
                      ctaButtonVariants({ size: "sm", variant: "light" }),
                      "font-sans font-semibold ring-1 ring-black/10"
                    )}
                    href={platform.listing.href}
                    rel="noopener"
                    target="_blank"
                  >
                    <McpPlatformIcon
                      className="size-4 dark:invert-0"
                      platform={platform}
                    />
                    {platform.listing.label}
                    <HugeiconsIcon className="size-4" icon={ArrowRight02Icon} />
                  </a>
                ) : null}
                <McpCommandTabs clients={getMcpPlatformCommands(platform)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex w-[min(100%-3rem,62.5rem)] flex-col gap-20 pt-8">
        <McpPlatformSteps platform={platform} />

        <McpPlatformPrompt
          platform={platform}
          prompt={copy.prompts[platform.kind]}
          variant={variant}
        />

        <section aria-labelledby="other-apps" className="flex flex-col gap-4">
          <h2 className={H2_CLASSNAME} id="other-apps">
            Use Notra in another app
          </h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((entry) => (
              <li key={entry.id}>
                <Link
                  className={PILL_CLASSNAME}
                  params={{ platform: entry.id }}
                  to="/mcp/$platform"
                >
                  <McpPlatformIcon
                    className="text-[1.25rem]"
                    platform={entry}
                  />
                  {entry.wideIcon ? null : entry.name}
                </Link>
              </li>
            ))}
            <li>
              <Link className={PILL_CLASSNAME} to="/mcp">
                All MCP clients
              </Link>
            </li>
          </ul>
        </section>

        <McpUseCasesCallout />
      </div>
    </div>
  );
}
