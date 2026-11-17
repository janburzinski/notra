import { AiSearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

export function SignupFreeScanBanner() {
  const t = useTranslations("auth.signup");
  return (
    <div className="bg-muted/40 flex items-center gap-2.5 rounded-xl border px-3 py-2.5">
      <HugeiconsIcon
        aria-hidden
        className="text-muted-foreground size-4 shrink-0"
        icon={AiSearchIcon}
      />
      <p className="text-muted-foreground text-xs">
        {t.rich("freeScan", {
          strong: (chunks) => (
            <span className="text-foreground font-medium">{chunks}</span>
          ),
        })}
      </p>
    </div>
  );
}
