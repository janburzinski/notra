import { useCallback, useRef, useState } from "react";

import type { AddRepoFlowMode, AddRepoFlowState } from "@/types/content/create";

function addRepoFlowMode(state: AddRepoFlowState): AddRepoFlowMode | null {
  if (state.step === "open") {
    return state.mode;
  }
  return state.step === "awaitingWebhook" ? "integration" : null;
}

export function useAddRepoFlow(onFlowEnded: () => void) {
  const [addRepo, setAddRepoState] = useState<AddRepoFlowState>({
    step: "closed",
  });
  const addRepoRef = useRef(addRepo);
  const setAddRepo = useCallback((next: AddRepoFlowState) => {
    addRepoRef.current = next;
    setAddRepoState(next);
  }, []);

  const handleAddRepoOpenChange = useCallback(
    (isOpen: boolean) => {
      if (addRepoRef.current.step === "awaitingWebhook") {
        setAddRepo({ step: "awaitingWebhook", open: isOpen });
        return;
      }
      if (isOpen) {
        return;
      }
      setAddRepo({ step: "closed" });
      onFlowEnded();
    },
    [onFlowEnded, setAddRepo]
  );

  const handleIntegrationSuccess = useCallback(() => {
    const current = addRepoRef.current;
    if (current.step === "open" && current.mode === "integration") {
      setAddRepo({ step: "awaitingWebhook", open: true });
    }
  }, [setAddRepo]);

  const handleIntegrationFlowComplete = useCallback(() => {
    setAddRepo({ step: "closed" });
    onFlowEnded();
  }, [onFlowEnded, setAddRepo]);

  return {
    addRepo,
    addRepoMode: addRepoFlowMode(addRepo),
    addRepoOpen:
      addRepo.step === "open" ||
      (addRepo.step === "awaitingWebhook" && addRepo.open),
    handleAddRepoOpenChange,
    handleIntegrationFlowComplete,
    handleIntegrationSuccess,
    setAddRepo,
  };
}
