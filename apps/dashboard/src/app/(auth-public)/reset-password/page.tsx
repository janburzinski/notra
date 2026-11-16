"use client";

import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useForm } from "@tanstack/react-form";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import { resetPasswordAction } from "@/lib/auth/password-actions";
import { useRouter } from "@/lib/navigation";

function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const tAuthShared = useTranslations("auth.shared");
  const tCommon2 = useTranslations("common");
  const router = useRouter();
  const [token] = useQueryState("token", parseAsString);
  const [error] = useQueryState(
    "error",
    parseAsStringLiteral(["INVALID_TOKEN"])
  );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      const { password, confirmPassword } = value;
      if (!(password && confirmPassword && token)) {
        return;
      }

      if (password.length < 8) {
        toast.error(t("passwordMin"));
        return;
      }

      if (password !== confirmPassword) {
        toast.error(t("passwordMismatch"));
        return;
      }

      let result: Awaited<ReturnType<typeof resetPasswordAction>>;
      try {
        result = await resetPasswordAction({ newPassword: password, token });
      } catch {
        toast.error(tAuthShared("networkErrorPleaseCheckYour"));
        return;
      }

      if (result.status === "error") {
        if (result.message?.includes("expired")) {
          toast.error(t("linkExpired"));
        } else if (result.message?.includes("invalid")) {
          toast.error(t("linkInvalid"));
        } else {
          toast.error(result.message ?? tCommon2("errors.generic"));
        }
        return;
      }

      toast.success(t("success"));
      router.push("/login");
    },
  });

  if (error === "INVALID_TOKEN") {
    return (
      <div className="mx-auto flex min-w-[300px] flex-col gap-8 rounded-md p-6 lg:w-[384px] lg:px-8 lg:py-10">
        <div className="text-center">
          <h1 className="text-xl font-semibold lg:text-2xl">
            {t("invalidTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("invalidDescription")}
          </p>
        </div>
        <Button
          className="w-full"
          nativeButton={false}
          render={<Link href="/forgot-password" />}
        >
          {t("requestNew")}
        </Button>
        <div className="text-muted-foreground px-8 text-center text-xs">
          <Link
            className="hover:text-primary underline underline-offset-4"
            href="/login"
          >
            {tAuthShared("backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-w-[300px] flex-col gap-8 rounded-md p-6 lg:w-[384px] lg:px-8 lg:py-10">
        <div className="text-center">
          <h1 className="text-xl font-semibold lg:text-2xl">
            {t("missingTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("missingDescription")}
          </p>
        </div>
        <Button
          className="w-full"
          nativeButton={false}
          render={<Link href="/forgot-password" />}
        >
          {t("requestNew")}
        </Button>
        <div className="text-muted-foreground px-8 text-center text-xs">
          <Link
            className="hover:text-primary underline underline-offset-4"
            href="/login"
          >
            {tAuthShared("backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-w-[300px] flex-col gap-8 rounded-md p-6 lg:w-[384px] lg:px-8 lg:py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold lg:text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isLoading) => (
            <>
              <div className="grid gap-3">
                <form.Field name="password">
                  {(field) => (
                    <div className="grid gap-1">
                      <Label className="sr-only" htmlFor={field.name}>
                        {tAuthShared("newPassword")}
                      </Label>
                      <div className="relative">
                        <Input
                          autoComplete="new-password"
                          className="pr-9"
                          disabled={isLoading}
                          id={field.name}
                          minLength={8}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={tAuthShared("newPassword")}
                          required
                          type={showPassword ? "text" : "password"}
                          value={field.state.value}
                        />
                        <button
                          aria-label={
                            showPassword
                              ? tCommon2("labels.hidePassword")
                              : tCommon2("labels.showPassword")
                          }
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2 disabled:opacity-50"
                          disabled={isLoading}
                          onClick={() => setShowPassword(!showPassword)}
                          type="button"
                        >
                          {showPassword ? (
                            <HugeiconsIcon
                              className="size-4"
                              icon={ViewOffSlashIcon}
                            />
                          ) : (
                            <HugeiconsIcon className="size-4" icon={ViewIcon} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form.Field>
                <form.Field name="confirmPassword">
                  {(field) => (
                    <div className="grid gap-1">
                      <Label className="sr-only" htmlFor={field.name}>
                        {t("confirmPassword")}
                      </Label>
                      <div className="relative">
                        <Input
                          autoComplete="new-password"
                          className="pr-9"
                          disabled={isLoading}
                          id={field.name}
                          minLength={8}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={t("confirmPasswordPlaceholder")}
                          required
                          type={showConfirmPassword ? "text" : "password"}
                          value={field.state.value}
                        />
                        <button
                          aria-label={
                            showConfirmPassword
                              ? t("hideConfirmPassword")
                              : t("showConfirmPassword")
                          }
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2 disabled:opacity-50"
                          disabled={isLoading}
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          type="button"
                        >
                          {showConfirmPassword ? (
                            <HugeiconsIcon
                              className="size-4"
                              icon={ViewOffSlashIcon}
                            />
                          ) : (
                            <HugeiconsIcon className="size-4" icon={ViewIcon} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {t("passwordMin")}
              </p>
              <Button className="mt-4 w-full" loading={isLoading} type="submit">
                {t("submit")}
              </Button>
            </>
          )}
        </form.Subscribe>
      </form>

      <div className="text-muted-foreground px-8 text-center text-xs">
        <Link
          className="hover:text-primary underline underline-offset-4"
          href="/login"
        >
          {tAuthShared("backToLogin")}
        </Link>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-w-[300px] flex-col gap-8 rounded-md p-6 lg:w-[384px] lg:px-8 lg:py-10">
          <div className="text-center">
            <h1 className="text-xl font-semibold lg:text-2xl">
              {tCommon("states.loading")}
            </h1>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
