import { LoginErrorTracker } from "@/components/auth/login-error-tracker";
import { LoginForm } from "@/components/auth/login-form";
import { SocialEnrollmentResume } from "@/components/auth/social-enrollment-resume";
import type { LoginPageProps } from "@/types/auth/login-page";

export default function LoginPage({ data }: LoginPageProps) {
  return (
    <div className="mx-auto w-full max-w-md rounded-md p-6 lg:px-8 lg:py-10">
      {data.knownErrorKey ? (
        <LoginErrorTracker errorCode={data.knownErrorKey} />
      ) : null}
      {data.resumeEnrollmentFlowId ? (
        <SocialEnrollmentResume
          flowId={data.resumeEnrollmentFlowId}
          returnTo={data.returnTo}
        />
      ) : (
        <LoginForm
          initialError={data.initialError}
          initialPending={data.pending}
          returnTo={data.returnTo}
        />
      )}
    </div>
  );
}
