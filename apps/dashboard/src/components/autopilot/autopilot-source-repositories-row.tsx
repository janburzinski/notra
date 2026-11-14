"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { SquareLock02Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_MAX_SOURCE_REPOSITORIES } from "@notra/db/constants/autopilot";
import { buttonVariants } from "@notra/ui/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@notra/ui/components/ui/combobox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AutopilotSettingsField } from "@/components/autopilot/autopilot-settings-field";
import { Button } from "@/components/button";
import { AUTOPILOT_SETTINGS_CONTROL_CLASSNAME } from "@/constants/autopilot-ui";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type {
  AutopilotRepositoryOption,
  AutopilotSourceRepositoriesRowProps,
} from "@/types/autopilot";
import {
  autopilotSourceSummary,
  sortByRecentPush,
} from "@/utils/autopilot-commit-filters";
import { formatRelativeDate } from "@/utils/content-preview";
import { toErrorMessage } from "@/utils/error-message";

const toKey = (repository: AutopilotRepositoryOption) =>
  repository.fullName.toLowerCase();

/** Which repositories release posts read; the list opens in a dropdown. */
export function AutopilotSourceRepositoriesRow({
  organizationId,
  filters,
  repositories,
}: AutopilotSourceRepositoriesRowProps) {
  const queryClient = useQueryClient();
  // Shows a pick at once. Saves run in order and only the newest one hands
  // the row back to the server's value, so a slower earlier save can't erase it.
  const [draft, setDraft] = useState<string[] | null>(null);
  const latestEdit = useRef(0);
  const picked = draft ?? filters.repositories;
  const save = useMutation({
    scope: { id: `autopilot-commit-filters:${organizationId}` },
    // Sends only the pick; the server keeps the author and path filters.
    mutationFn: (edit: { repositories: string[]; version: number }) =>
      dashboardOrpc.autopilot.setCommitFilters.call({
        organizationId,
        filters: { repositories: edit.repositories },
      }),
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the repositories")),
    onSettled: async (_data, _error, edit) => {
      if (edit.version !== latestEdit.current) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
      if (edit.version === latestEdit.current) {
        setDraft(null);
      }
    },
  });
  const setPicked = (next: string[]) => {
    latestEdit.current += 1;
    setDraft(next);
    save.mutate({ repositories: next, version: latestEdit.current });
  };

  const sorted = sortByRecentPush(repositories);
  const known = new Set(sorted.map(toKey));
  // Picks the GitHub App no longer sees (renamed, removed) stay listed so
  // they can be seen and unticked; Autopilot reads nothing from them.
  const missing: AutopilotRepositoryOption[] = picked
    .filter((name) => !known.has(name))
    .map((name) => {
      const [owner = "", repositoryName = name] = name.split("/");
      return {
        owner,
        name: repositoryName,
        fullName: name,
        defaultBranch: "",
        private: false,
        pushedAt: null,
      };
    });
  const options = [...sorted, ...missing];
  const pickedSet = new Set(picked);
  const selected = options.filter((repository) =>
    pickedSet.has(toKey(repository))
  );
  const missingSet = new Set(missing.map(toKey));
  const full = picked.length >= AUTOPILOT_MAX_SOURCE_REPOSITORIES;
  const [first] = selected;
  let summary = "Automatic";
  if (first) {
    summary =
      selected.length === 1
        ? first.fullName
        : `${first.fullName} +${selected.length - 1}`;
  }

  return (
    <AutopilotSettingsField
      description={autopilotSourceSummary(sorted, picked)}
      htmlFor="autopilot-read-from"
      label="Read from"
    >
      <Combobox
        isItemEqualToValue={(item, current) =>
          item.fullName === current.fullName
        }
        itemToStringLabel={(item: AutopilotRepositoryOption) => item.fullName}
        items={options}
        multiple
        onValueChange={(next: AutopilotRepositoryOption[]) => {
          setPicked(next.map(toKey));
        }}
        value={selected}
      >
        <ComboboxPrimitive.Trigger
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            AUTOPILOT_SETTINGS_CONTROL_CLASSNAME,
            "justify-between font-normal active:scale-100",
            !first && "text-foreground/70"
          )}
          id="autopilot-read-from"
        >
          <span className="truncate">{summary}</span>
          <HugeiconsIcon
            className="text-muted-foreground size-4 shrink-0"
            icon={UnfoldMoreIcon}
          />
        </ComboboxPrimitive.Trigger>
        <ComboboxContent
          align="end"
          className="flex w-96 flex-col *:data-[slot=input-group]:m-1.5 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:shrink-0"
        >
          <ComboboxInput
            placeholder="Search repositories"
            showTrigger={false}
          />
          <ComboboxEmpty>No repository matches.</ComboboxEmpty>
          <ComboboxList className="mt-1 min-h-0 flex-1">
            {(repository: AutopilotRepositoryOption) => (
              <ComboboxItem
                disabled={full && !pickedSet.has(toKey(repository))}
                key={repository.fullName}
                value={repository}
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 py-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">
                        {repository.owner}/
                      </span>
                      {repository.name}
                    </span>
                    {repository.private ? (
                      <HugeiconsIcon
                        aria-label="Private"
                        className="text-muted-foreground size-3 shrink-0"
                        icon={SquareLock02Icon}
                        role="img"
                      />
                    ) : null}
                  </span>
                  {missingSet.has(toKey(repository)) ? (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      No longer connected
                    </span>
                  ) : null}
                  {repository.pushedAt ? (
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {formatRelativeDate(repository.pushedAt)}
                    </span>
                  ) : null}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
          <div className="border-table-row-border text-muted-foreground flex min-h-10 shrink-0 items-center justify-between gap-2 border-t px-3 py-1.5 text-xs">
            <span>
              {picked.length > 0
                ? `${picked.length} of ${AUTOPILOT_MAX_SOURCE_REPOSITORIES} picked`
                : "Nothing picked, Autopilot reads the most recently pushed"}
            </span>
            {picked.length > 0 ? (
              <Button
                onClick={() => {
                  setPicked([]);
                }}
                size="xs"
                variant="ghost"
              >
                Back to automatic
              </Button>
            ) : null}
          </div>
        </ComboboxContent>
      </Combobox>
    </AutopilotSettingsField>
  );
}
