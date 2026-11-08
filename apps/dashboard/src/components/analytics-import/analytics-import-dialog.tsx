"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTrigger,
} from "@notra/ui/components/shared/responsive-dialog";
import { useEffect, useRef, useState } from "react";

import { useAnalyticsImports } from "@/lib/hooks/use-analytics-imports";
import { useShownImportView } from "@/lib/hooks/use-shown-import-view";
import type { AnalyticsImportSummary } from "@/types/analytics-imports";
import type {
  AnalyticsImportDialogProps,
  AnalyticsImportView,
} from "@/types/components/analytics-import";
import { importStepFor } from "@/utils/analytics-imports";

import { ImportConnectStep } from "./import-connect-step";
import { ImportCsvStep } from "./import-csv-step";
import { ImportDialogHeader } from "./import-dialog-header";
import { ImportHomeStep } from "./import-home-step";
import { ImportProgressStep } from "./import-progress-step";
import { ImportSourceStep } from "./import-source-step";

export function AnalyticsImportDialog({
  organizationId,
  projectId,
  defaultHost,
  trigger,
  open: controlledOpen,
  onOpenChange,
  manageOnly = false,
}: AnalyticsImportDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const [view, setView] = useState<AnalyticsImportView>({ step: "home" });
  const backRef = useRef<HTMLButtonElement>(null);
  const { data, isPending } = useAnalyticsImports(
    organizationId,
    projectId,
    open
  );
  const connections = data?.connections ?? [];
  const canManage = data?.canManage ?? false;
  const home = () => setView({ step: "home" });
  const showProgress = (item: AnalyticsImportSummary) =>
    setView({ step: "progress", item });
  const shownView = useShownImportView(view, data?.imports);

  useEffect(() => {
    if (view.step !== "home") {
      backRef.current?.focus();
    }
  }, [view]);

  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) {
      home();
    }
  };

  return (
    <ResponsiveDialog onOpenChange={setOpen} open={open}>
      {trigger ? <ResponsiveDialogTrigger render={trigger} /> : null}
      <ResponsiveDialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <ImportDialogHeader
          backRef={backRef}
          manageOnly={manageOnly}
          onBack={home}
          view={shownView}
        />
        {view.step === "home" ? (
          <ImportHomeStep
            canManage={canManage}
            connections={connections}
            imports={data?.imports ?? []}
            isPending={isPending}
            manageOnly={manageOnly}
            onOpen={showProgress}
            onPick={(provider) => setView(importStepFor(provider))}
            onReconnect={
              manageOnly
                ? undefined
                : (connection) =>
                    setView({
                      step: "connect",
                      provider: connection.provider,
                      connectionId: connection.id,
                    })
            }
            organizationId={organizationId}
          />
        ) : null}
        {view.step === "csv" && projectId ? (
          <ImportCsvStep
            defaultHost={defaultHost}
            onStarted={showProgress}
            organizationId={organizationId}
            projectId={projectId}
          />
        ) : null}
        {view.step === "connect" ? (
          <ImportConnectStep
            canManage={canManage}
            connections={connections}
            onConnected={(connectionId) =>
              setView({ step: "source", provider: view.provider, connectionId })
            }
            organizationId={organizationId}
            provider={view.provider}
            reconnectId={view.connectionId}
          />
        ) : null}
        {view.step === "source" && projectId ? (
          <ImportSourceStep
            connectionId={view.connectionId}
            defaultHost={defaultHost}
            onReconnect={() =>
              setView({
                step: "connect",
                provider: view.provider,
                connectionId: view.connectionId,
              })
            }
            onStarted={showProgress}
            organizationId={organizationId}
            projectId={projectId}
          />
        ) : null}
        {shownView.step === "progress" ? (
          <ImportProgressStep
            item={shownView.item}
            onBack={home}
            onClose={() => setOpen(false)}
            onImportAnother={manageOnly ? undefined : home}
          />
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
