import { AiSearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

export function SignupFreeScanBanner() {
  const t = useTranslations("auth.signup");
  return (
    <div className="bg-primary/5 ring-primary/15 flex items-start gap-3 rounded-xl p-3 ring-1">
      <span className="bg-primary text-primary-foreground flex size-[2.125rem] shrink-0 items-center justify-center rounded-[0.625rem]">
        <HugeiconsIcon className="size-4" icon={AiSearchIcon} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.84375rem] leading-5 font-semibold">
          {t("freeScanTitle")}
        </span>
        <span className="text-muted-foreground text-[0.8125rem] leading-[1.1875rem]">
          {t("freeScanDescription")}
        </span>
      </div>
    </div>
  );
}
