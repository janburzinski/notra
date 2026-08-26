import { ArrowDown01Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { HERO_COLLAGE_PROFILE } from "@/constants/landing/hero-collage";

function FieldValue({ value }: { value: string }) {
  return <Input defaultValue={value} />;
}

export function HeroCollageProfilePanel() {
  return (
    <div className="bg-background relative z-20 -mx-26 w-[30rem] shrink-0 self-center rounded-3xl border border-black/5 px-12 py-5 shadow-[0_0.125rem_4.4375rem_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out lg:motion-safe:hover:scale-[1.02] dark:border-white/10">
      <div className="mb-6 space-y-1">
        <h3 className="text-foreground font-sans text-[1.375rem] leading-[1.2] font-bold tracking-[-0.046875rem]">
          {HERO_COLLAGE_PROFILE.heading}
        </h3>
        <p className="text-muted-foreground text-sm leading-[1.5]">
          {HERO_COLLAGE_PROFILE.subhead}
        </p>
      </div>

      <div className="space-y-6">
        <TitleCard heading={HERO_COLLAGE_PROFILE.sectionCompany}>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>{HERO_COLLAGE_PROFILE.companyNameLabel}</Label>
              <FieldValue value={HERO_COLLAGE_PROFILE.companyNameValue} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-profile-website">
                {HERO_COLLAGE_PROFILE.websiteLabel}
              </Label>
              <div className="border-input focus-within:border-ring focus-within:ring-ring/50 flex w-full flex-row items-center overflow-hidden rounded-lg border transition-colors focus-within:ring-[3px]">
                <span className="border-input text-muted-foreground border-r px-2.5 py-1.5 text-sm">
                  {HERO_COLLAGE_PROFILE.websitePrefix}
                </span>
                <input
                  className="placeholder:text-muted-foreground w-full min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  defaultValue={HERO_COLLAGE_PROFILE.websiteValue}
                  id="hero-profile-website"
                  inputMode="url"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{HERO_COLLAGE_PROFILE.descriptionLabel}</Label>
              <FieldValue value={HERO_COLLAGE_PROFILE.descriptionValue} />
            </div>
          </div>
        </TitleCard>

        <TitleCard heading={HERO_COLLAGE_PROFILE.sectionAudience}>
          <div className="space-y-2">
            <Label>{HERO_COLLAGE_PROFILE.audienceLabel}</Label>
            <FieldValue value={HERO_COLLAGE_PROFILE.audienceValue} />
          </div>
        </TitleCard>

        <TitleCard heading={HERO_COLLAGE_PROFILE.sectionTone}>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full">
                  <svg
                    aria-hidden="true"
                    className="size-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-sm">
                  {HERO_COLLAGE_PROFILE.toneProfileLabel}
                </span>
              </div>
              <div className="border-input flex h-8 w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap">
                {HERO_COLLAGE_PROFILE.toneProfileValue}
                <HugeiconsIcon
                  className="text-muted-foreground size-4"
                  icon={UnfoldMoreIcon}
                />
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2">
                <span className="border-muted-foreground/30 size-5 rounded-full border-2" />
                <span className="text-sm">
                  {HERO_COLLAGE_PROFILE.customToneLabel}
                </span>
              </div>
              <Input
                className="opacity-50"
                placeholder={HERO_COLLAGE_PROFILE.customTonePlaceholder}
              />
            </div>

            <div className="space-y-2 pt-4">
              <Label>{HERO_COLLAGE_PROFILE.languageLabel}</Label>
              <div className="border-input flex h-8 items-center justify-between gap-1.5 rounded-lg border bg-transparent px-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">
                    {HERO_COLLAGE_PROFILE.languageFlag}
                  </span>
                  {HERO_COLLAGE_PROFILE.languageValue}
                </span>
                <HugeiconsIcon
                  className="text-muted-foreground size-4"
                  icon={ArrowDown01Icon}
                />
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <Label>{HERO_COLLAGE_PROFILE.customInstructionsLabel}</Label>
              <Input
                placeholder={HERO_COLLAGE_PROFILE.customInstructionsPlaceholder}
              />
            </div>
          </div>
        </TitleCard>
      </div>
    </div>
  );
}
