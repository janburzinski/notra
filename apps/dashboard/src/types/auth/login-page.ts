import type { PendingAuthStep } from "@notra/schemas/types/dashboard/auth";

export interface LoginPageStart {
  pending?: PendingAuthStep;
  resumeEnrollmentFlowId?: string;
}

export interface LoginPageProps {
  data: LoginPageStart & {
    returnTo?: string;
    knownErrorKey?: string;
    initialError?: string;
  };
}

export interface SocialEnrollmentResumeProps {
  flowId: string;
  returnTo?: string;
}
