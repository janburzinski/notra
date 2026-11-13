"use client";

import { parseAsBoolean, useQueryStates } from "nuqs";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

export function useLinearConnectionToast() {
  const t = useTranslations("integrations.connectionToasts");
  const [{ linearConnected, linearReconnected }, setParams] = useQueryStates(
    { linearConnected: parseAsBoolean, linearReconnected: parseAsBoolean },
    { history: "replace" }
  );

  useEffect(() => {
    if (linearConnected) {
      toast.success(t("linearConnected"));
      void setParams({ linearConnected: null });
    } else if (linearReconnected) {
      toast.success(t("linearReconnected"));
      void setParams({ linearReconnected: null });
    }
  }, [linearConnected, linearReconnected, setParams, t]);
}
