import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { PageContainer } from "@/components/layout/container";

import { CollectionsPageSkeleton } from "./skeleton";

export default function Loading() {
  const t = useTranslations("content.list");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.content")}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-[6.75rem] rounded-md" />
            <Skeleton className="h-9 w-[11.75rem] rounded-md" />
          </div>
        </PageHeading>
        <div className="space-y-3">
          <div className="flex min-h-8 items-center">
            <Skeleton className="h-8 w-56 rounded-md" />
          </div>
          <CollectionsPageSkeleton />
        </div>
      </div>
    </PageContainer>
  );
}
