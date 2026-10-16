"use client";

import { AuthFormError } from "@notra/ui/components/shared/auth/auth-form-error";
import { ctaButtonVariants } from "@notra/ui/components/shared/cta-button";

import type { ConsoleLoginFormProps } from "@/types/auth";

export function LoginForm({ returnTo, initialError }: ConsoleLoginFormProps) {
  return (
    <div className="grid gap-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Notra Console</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Sign in securely with your Notra account. Password, social sign-in and
          multi-factor authentication are handled by WorkOS.
        </p>
      </div>
      <AuthFormError error={initialError ?? null} />
      <a
        className={ctaButtonVariants()}
        href={`/auth/sign-in${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
      >
        Continue to sign in
      </a>
    </div>
  );
}
