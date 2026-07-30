"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";

type PrivacyField = "hidePersonalData" | "showAgentStats";

function usePrivacyField(field: PrivacyField): {
  value: boolean;
  hasHydrated: boolean;
  isUpdating: boolean;
  setValue: (value: boolean) => void;
} {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [optimisticValue, setOptimisticValue] = useState<boolean | null>(null);
  const updateInFlightRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await authClient.updateUser(
        { [field]: value },
        { disableSignal: true }
      );
      if (error) {
        throw new Error(error.message ?? "Failed to update preference");
      }

      await refetch();
      const refreshedSession = authClient.$store.atoms.session?.get();
      const sessionSettled =
        refreshedSession &&
        !(refreshedSession.isPending || refreshedSession.isRefetching) &&
        !refreshedSession.error;

      return {
        confirmed:
          sessionSettled && refreshedSession.data?.user?.[field] === value,
        syncFailed: !sessionSettled,
      };
    },
    onError: (error) => {
      setOptimisticValue(null);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update preference. Please try again."
      );
    },
    onSuccess: (result) => {
      if (result.confirmed) {
        return;
      }

      if (result.syncFailed) {
        toast.warning(
          "Preference saved, but account state could not be refreshed."
        );
        authClient.$store.notify("$sessionSignal");
        return;
      }

      setOptimisticValue(null);
      toast.error("Preference update could not be confirmed.");
    },
    onSettled: () => {
      updateInFlightRef.current = false;
    },
  });

  const persisted = session?.user?.[field] ?? false;

  useEffect(() => {
    if (optimisticValue === persisted) {
      setOptimisticValue(null);
    }
  }, [optimisticValue, persisted]);

  return {
    value: optimisticValue ?? persisted,
    hasHydrated: !isPending,
    isUpdating: mutation.isPending,
    setValue: (value: boolean) => {
      if (updateInFlightRef.current) {
        return;
      }
      updateInFlightRef.current = true;
      setOptimisticValue(value);
      mutation.mutate(value);
    },
  };
}

export function useHidePersonalData(): {
  hidePersonalData: boolean;
  hasHydrated: boolean;
  isUpdating: boolean;
  setHidePersonalData: (value: boolean) => void;
} {
  const { value, hasHydrated, isUpdating, setValue } =
    usePrivacyField("hidePersonalData");
  return {
    hidePersonalData: value,
    hasHydrated,
    isUpdating,
    setHidePersonalData: setValue,
  };
}

export function useShowAgentStats(): {
  showAgentStats: boolean;
  hasHydrated: boolean;
  isUpdating: boolean;
  setShowAgentStats: (value: boolean) => void;
} {
  const { value, hasHydrated, isUpdating, setValue } =
    usePrivacyField("showAgentStats");
  return {
    showAgentStats: value,
    hasHydrated,
    isUpdating,
    setShowAgentStats: setValue,
  };
}
