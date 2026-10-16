import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { PageContainer } from "@/components/layout/container";

import {
  GitHubIntegrationSkeleton,
  GitHubRepositoriesSkeleton,
} from "./skeleton";

export default function Loading() {
  const tIntegrationsShared = useTranslations("integrations.shared");
  const tApp = useTranslations("integrations.github.appSection");

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-10 px-4 lg:px-6">
        <PageHeading title="GitHub">
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Button disabled>
              <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
              {tIntegrationsShared("connectGithub")}
              <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
            </Button>
            <Button disabled variant="outline">
              {tApp("connectWithToken")}
            </Button>
          </div>
        </PageHeading>
        <TitleCard
          contentClassName="p-0"
          heading={<Skeleton className="h-5 w-24" />}
          headingAs="div"
        >
          <GitHubIntegrationSkeleton />
        </TitleCard>
        <GitHubRepositoriesSkeleton />
      </div>
    </PageContainer>
  );
}
