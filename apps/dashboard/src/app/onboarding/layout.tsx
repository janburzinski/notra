import { OnboardingAccountMenu } from "@/components/onboarding/account-menu";
import { OnboardingRuntimeProviders } from "@/components/providers/onboarding-runtime-providers";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingRuntimeProviders>
      <div className="relative min-h-screen w-full">
        <div className="fixed bottom-4 left-[1.625rem] z-10 lg:left-[2.625rem]">
          <OnboardingAccountMenu />
        </div>
        {children}
      </div>
    </OnboardingRuntimeProviders>
  );
}
