import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { SiteBranchCreateFormProps } from "@/types/site-branches";

export function SiteBranchCreateForm({
  loading,
  onCreate,
}: SiteBranchCreateFormProps) {
  const t = useTranslations("sites.branches");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <form action={() => onCreate(title)} className="space-y-3 p-3">
      <div className="space-y-2">
        <Label htmlFor={id}>{t("optionalTitle")}</Label>
        <Input
          ref={input}
          id={id}
          autoComplete="off"
          maxLength={100}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") {
              event.stopPropagation();
            }
          }}
          aria-describedby={`${id}-hint`}
          disabled={loading}
        />
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {t("nameHint")}
        </p>
      </div>
      <div className="flex justify-end">
        <Button size="sm" type="submit" loading={loading}>
          {t("confirmCreate")}
        </Button>
      </div>
    </form>
  );
}
