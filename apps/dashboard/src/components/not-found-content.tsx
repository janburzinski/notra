"use client";

import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { useRouter } from "@/lib/navigation";
import type { NotFoundContentProps } from "@/types/components/not-found";

export function NotFoundContent({ className }: NotFoundContentProps) {
  const t = useTranslations("errors.notFound");
  const tErrorsShared = useTranslations("errors.shared");
  const router = useRouter();

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center px-4",
        className
      )}
    >
      <div className="text-center">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-md text-base">
          {t("description")}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link className={cn(buttonVariants())} href="/">
            {tErrorsShared("goHome")}
          </Link>
          <Button onClick={() => router.back()} type="button" variant="outline">
            {t("goBack")}
          </Button>
        </div>
      </div>
    </div>
  );
}
