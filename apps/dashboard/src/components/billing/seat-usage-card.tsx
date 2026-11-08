"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import { Button } from "@notra/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { fetchSeats, inviteSeat } from "@/lib/billing/seats";

export function SeatUsageCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations("settings.billing");
  const [metric, setMetric] = useState<"seats" | "invites">("seats");
  const { data, isPending } = useQuery({
    queryKey: ["seats", organizationId],
    queryFn: () => fetchSeats(organizationId),
  });
  const invite = useMutation({ mutationFn: () => inviteSeat(organizationId) });

  if (isPending) {
    return <div className="h-24 animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Seat usage</h1>
        <Badge className="bg-green-100 text-green-700">Active</Badge>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          className="rounded-md px-2 py-1 text-xs outline-none"
          onClick={() => setMetric("seats")}
          type="button"
        >
          Seats
        </button>
        <button
          className="rounded-md px-2 py-1 text-xs outline-none"
          onClick={() => setMetric("invites")}
          type="button"
        >
          Invites
        </button>
      </div>
      <p className="mt-3 text-sm text-black/40">
        {data?.used} of {data?.total} seats used — invite teammates to collaborate.
      </p>
      <div className="mt-6 flex items-center gap-3 whitespace-nowrap">
        <span className="text-sm">{t("description")}</span>
        <Button
          className="w-40 transition-all"
          disabled={invite.isPending}
          onClick={() => invite.mutate()}
        >
          Invite a teammate
        </Button>
      </div>
      {metric === "seats" ? null : <span className="animate-spin">⟳</span>}
    </div>
  );
}
