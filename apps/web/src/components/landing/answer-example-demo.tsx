import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GeoPromptAnswerThread } from "@notra/ui/components/geo/geo-prompt-answer-thread";
import { PromptEngineSwitcher } from "@notra/ui/components/geo/prompt-engine-switcher";
import { Button } from "@notra/ui/components/ui/button";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";

import {
  ANSWER_EXAMPLE_DEFAULT_ENGINE,
  ANSWER_EXAMPLE_RESULTS,
  ANSWER_EXAMPLE_TIMESTAMP,
  ANSWER_EXAMPLE_TIMESTAMP_FORMAT,
} from "@/constants/landing/answer-example";
import { GEO_ENGINE_NAMES } from "@/constants/landing/geo-engines";

const SWITCHER_ITEMS = ANSWER_EXAMPLE_RESULTS.map((result) => ({
  engine: result.id,
  family: GEO_ENGINE_NAMES[result.id],
  label: GEO_ENGINE_NAMES[result.id],
  showSearchIcon: false,
}));

export function AnswerExampleDemo() {
  const t = useTranslations("landing.answers");
  const format = useFormatter();
  const prompt = t("prompt");
  const [engine, setEngine] = useState<string>(ANSWER_EXAMPLE_DEFAULT_ENGINE);
  const [expanded, setExpanded] = useState(false);
  const active =
    ANSWER_EXAMPLE_RESULTS.find((result) => result.id === engine) ??
    ANSWER_EXAMPLE_RESULTS[0];

  return (
    <div className="border-border bg-background flex flex-col overflow-hidden rounded-2xl border shadow-[0_0.125rem_1.4375rem_#0000001A,0_0.0625rem_0.125rem_#0000000A] lg:h-[40rem] dark:shadow-none">
      <div className="border-border flex shrink-0 flex-col gap-3 border-b px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
        <p className="text-lg leading-snug font-semibold text-balance sm:text-xl">
          {prompt}
        </p>
        <PromptEngineSwitcher
          active={engine}
          compactOnMobile
          items={SWITCHER_ITEMS}
          onChange={setEngine}
        />
      </div>
      {active ? (
        <div
          className={cn(
            "flex min-h-0 flex-col lg:flex-1",
            !expanded &&
              "max-lg:h-[23rem] max-lg:overflow-hidden max-lg:[mask-image:linear-gradient(to_bottom,black_62%,transparent)]"
          )}
          onFocus={() => setExpanded(true)}
        >
          <GeoPromptAnswerThread
            fitContentBelowLg
            key={active.id}
            prompt={prompt}
            result={{
              engine: active.id,
              excerpt: t(`excerpts.${active.id}`),
              mentioned: active.mentioned,
            }}
            timestamp={format.dateTime(
              ANSWER_EXAMPLE_TIMESTAMP,
              ANSWER_EXAMPLE_TIMESTAMP_FORMAT
            )}
          />
        </div>
      ) : null}
      {expanded ? null : (
        <div className="relative -mt-10 flex justify-center pb-5 lg:hidden">
          <Button
            onClick={() => setExpanded(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("expand")}
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
          </Button>
        </div>
      )}
    </div>
  );
}
