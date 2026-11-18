"use client";

import { Label } from "@notra/ui/components/ui/label";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Switch } from "@notra/ui/components/ui/switch";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { DomainAutoInviteCardProps } from "@/types/settings/members";

export function DomainAutoInviteCard({
  organizationId,
  organizationName,
}: DomainAutoInviteCardProps) {
  const t = useTranslations("settings.panes.members.domainAutoInvite");
  const queryClient = useQueryClient();
  const queryOptions = dashboardOrpc.domainAutoInvite.get.queryOptions({
    input: { organizationId },
  });
  const { data: state, isPending: isLoading } = useQuery(queryOptions);

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: (enabled: boolean) =>
      dashboardOrpc.domainAutoInvite.update.call({ organizationId, enabled }),
    onSuccess: (next) => {
      queryClient.setQueryData(queryOptions.queryKey, next);
      toast.success(next.enabledDomain ? t("enabled") : t("disabled"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    },
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  const domain = state?.enabledDomain ?? state?.eligibleDomain;
  if (!(state && domain)) {
    return null;
  }

  return (
    <TitleCard heading={t("heading")}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label className="cursor-pointer" htmlFor="domain-auto-invite">
            {t.rich("label", {
              domain,
              code: (chunks) => (
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  {chunks}
                </code>
              ),
            })}
          </Label>
          <p className="text-muted-foreground text-xs">
            {t("description", { organization: organizationName })}
          </p>
          {state.canManage ? null : (
            <p className="text-muted-foreground text-xs">{t("managersOnly")}</p>
          )}
        </div>
        <Switch
          checked={state.enabledDomain !== null}
          disabled={!state.canManage || isUpdating}
          id="domain-auto-invite"
          onCheckedChange={(enabled) => update(enabled)}
        />
      </div>
    </TitleCard>
  );
}
