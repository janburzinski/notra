"use client";

import { PencilEdit02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_EDIT_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Input } from "@notra/ui/components/ui/input";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { SiteBranchMenuProps } from "@/types/site-branches";

export function SiteBranchMenu({
  open,
  onOpenChange,
  current,
  productionBranch,
  entries,
  loading,
  disabled,
  search,
  onSearch,
  onSelect,
  onAction,
}: SiteBranchMenuProps) {
  const t = useTranslations("sites.branches");
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" disabled={disabled} className="max-w-64" />
        }
        aria-label={t("current", { branch: current })}
      >
        <span className="truncate">{current}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 max-w-[90vw]">
        <div className="p-2">
          <Input
            aria-label={t("find")}
            placeholder={t("find")}
            onKeyDown={(event) => {
              if (event.key !== "Escape") {
                event.stopPropagation();
              }
            }}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-auto">
          {loading ? (
            <p className="text-muted-foreground px-2 py-1 text-xs">
              {t("loading")}
            </p>
          ) : null}
          {entries.map((entry) => (
            <div key={entry.name} className="group flex items-center gap-1">
              <DropdownMenuItem
                className="min-w-0 flex-1"
                disabled={!entry.exists}
                onClick={() => onSelect(entry.name)}
              >
                <span className="truncate">{entry.name}</span>
                {entry.status ? (
                  <span className="text-muted-foreground ms-auto text-xs">
                    {t(`status.${entry.status}`)}
                  </span>
                ) : null}
              </DropdownMenuItem>
              {entry.name !== productionBranch &&
              entry.name.startsWith(SITE_EDIT_BRANCH_PREFIX) ? (
                <>
                  {entry.exists ? (
                    <>
                      <DropdownMenuItem
                        render={<Button size="icon-sm" variant="ghost" />}
                        aria-label={t("renameFor", { branch: entry.name })}
                        onClick={() =>
                          onAction({ kind: "rename", branch: entry.name })
                        }
                      >
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={PencilEdit02Icon}
                          size={16}
                        />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={<Button size="icon-sm" variant="ghost" />}
                        aria-label={t("deleteFor", { branch: entry.name })}
                        onClick={() =>
                          onAction({ kind: "delete", branch: entry.name })
                        }
                      >
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={Delete02Icon}
                          size={16}
                        />
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      onClick={() =>
                        onAction({ kind: "discardDeleted", branch: entry.name })
                      }
                    >
                      {t("discardDeleted")}
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </div>
          ))}
        </div>
        <DropdownMenuItem
          onClick={() => onAction({ kind: "create", branch: current })}
        >
          {t("newBranch")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
