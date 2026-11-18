import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Gemini } from "@notra/ui/components/ui/svgs/gemini";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Google } from "@notra/ui/components/ui/svgs/google";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { Perplexity } from "@notra/ui/components/ui/svgs/perplexity";
import { Slack } from "@notra/ui/components/ui/svgs/slack";
import { cn } from "@notra/ui/lib/utils";

import { AUTOPILOT_PARTNERS } from "@/constants/feature-pages/autopilot";
import { FEATURE_SECTION_CLASS } from "@/constants/feature-pages/layout";
import type { AutopilotPartnerLogo } from "@/types/autopilot-page";

const LOGO_CLASS = "size-5 shrink-0";

function PartnerLogo({ logo }: { logo: AutopilotPartnerLogo }) {
  switch (logo) {
    case "chatgpt": {
      return (
        <Openai
          aria-hidden="true"
          className={cn(LOGO_CLASS, "dark:fill-white")}
        />
      );
    }
    case "claude": {
      return <ClaudeAiIcon aria-hidden="true" className={LOGO_CLASS} />;
    }
    case "gemini": {
      return <Gemini aria-hidden="true" className={LOGO_CLASS} />;
    }
    case "perplexity": {
      return <Perplexity aria-hidden="true" className={LOGO_CLASS} />;
    }
    case "google": {
      return <Google aria-hidden="true" className={LOGO_CLASS} />;
    }
    case "github": {
      return (
        <Github
          aria-hidden="true"
          className={cn(LOGO_CLASS, "text-[#1E1E1E] dark:text-white")}
        />
      );
    }
    default: {
      return <Slack aria-hidden="true" className={LOGO_CLASS} />;
    }
  }
}

export function AutopilotWorksWith() {
  return (
    <section
      className={cn(
        FEATURE_SECTION_CLASS,
        "-mt-6 flex flex-col items-center gap-6 lg:-mt-8"
      )}
    >
      <p className="font-display text-center text-sm/5 font-medium tracking-[-0.01em] text-[#1E1E1EB3] sm:text-base/6 dark:text-white/50">
        {AUTOPILOT_PARTNERS.label}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 lg:gap-x-14">
        {AUTOPILOT_PARTNERS.items.map((item) => (
          <li className="flex items-center gap-2" key={item.label}>
            <PartnerLogo logo={item.logo} />
            <span className="font-sans text-[0.9375rem] font-medium text-[#4A4A4A] dark:text-white/70">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
