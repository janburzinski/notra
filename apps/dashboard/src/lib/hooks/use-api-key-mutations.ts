import type {
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from "@notra/schemas/dashboard/api-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ApiKeyMutationResponse,
  CreateApiKeyResponse,
  UseApiKeyMutationsOptions,
} from "@/types/api-keys";

export function useApiKeyMutations({
  organizationId,
  onCreated,
  onUpdated,
  onDeleted,
}: UseApiKeyMutationsOptions) {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const requireOrganizationId = () => {
    if (!organizationId) {
      throw new Error(tCommon("labels.organizationIdIsRequired"));
    }
    return organizationId;
  };

  const refreshKeys = (message: string) => {
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.apiKeys.list.queryKey({
        input: { organizationId: organizationId ?? "" },
      }),
    });
    toast.success(message);
  };

  const showError = (error: Error) => {
    toast.error(error.message);
  };

  const create = useMutation({
    mutationFn: async (values: CreateApiKeyInput) =>
      dashboardOrpc.apiKeys.create.call({
        organizationId: requireOrganizationId(),
        ...values,
      }) as Promise<CreateApiKeyResponse>,
    onSuccess: (data) => {
      onCreated(data);
      refreshKeys(t("toasts.created"));
    },
    onError: showError,
  });

  const update = useMutation({
    mutationFn: async (values: UpdateApiKeyInput) =>
      dashboardOrpc.apiKeys.update.call({
        organizationId: requireOrganizationId(),
        keyIdParam: values.keyId,
        payload: values,
      }) as Promise<ApiKeyMutationResponse>,
    onSuccess: () => {
      onUpdated();
      refreshKeys(t("toasts.updated"));
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: async (keyId: string) =>
      dashboardOrpc.apiKeys.delete.call({
        organizationId: requireOrganizationId(),
        keyIdParam: keyId,
        payload: { keyId },
      }) as Promise<ApiKeyMutationResponse>,
    onSuccess: () => {
      onDeleted();
      refreshKeys(t("toasts.deleted"));
    },
    onError: showError,
  });

  return { create, update, remove };
}
