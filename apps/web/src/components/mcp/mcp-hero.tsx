import { useRef } from "react";

import { HeroDither } from "@/components/landing/hero-dither";
import { McpCommandTabs } from "@/components/mcp/mcp-command-tabs";
import { McpHeroBattle } from "@/components/mcp/mcp-hero-battle";
import type { McpHeroProps } from "@/types/mcp";

export function McpHero({ subhead }: McpHeroProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  return (
    <section className="w-full px-6 pt-6 antialiased [font-synthesis:none]">
      <div
        className="relative isolate cursor-crosshair overflow-clip rounded-3xl bg-[#EFEAFA] dark:bg-[#2a2140]"
        ref={areaRef}
      >
        <div className="pointer-events-none absolute inset-0 overflow-clip rounded-3xl">
          <HeroDither />
          <McpHeroBattle areaRef={areaRef} avoidRef={contentRef} />
        </div>

        <div className="relative flex w-full flex-col items-center px-6 pt-20 pb-20 lg:pt-24">
          <div
            className="flex w-full max-w-[45rem] cursor-auto flex-col items-center gap-10"
            ref={contentRef}
          >
            <div className="flex flex-col items-center gap-6">
              <h1 className="font-display max-w-[51.25rem] text-center text-[2.5rem] leading-[1.12] font-medium tracking-[-0.015em] text-balance text-[#1E1E1E] sm:text-[3.25rem] lg:text-[4rem] dark:text-white">
                Notra, for your <span className="text-primary">agent</span>.
              </h1>
              <p className="max-w-[38.75rem] text-center font-sans text-[1.0625rem] leading-[1.42] font-medium tracking-[-0.005em] text-pretty text-[#1E1E1EBF] sm:text-[1.1875rem] dark:text-white/70">
                {subhead}
              </p>
            </div>
            <McpCommandTabs />
          </div>
        </div>
      </div>
    </section>
  );
}
