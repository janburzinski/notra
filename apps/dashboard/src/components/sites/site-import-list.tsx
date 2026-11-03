"use client";

import {
  Github01Icon,
  Search01Icon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { SadCapybara } from "@/components/sad-capybara";
import { SiteImportAccessActions } from "@/components/sites/site-import-access-actions";
import {
  SITE_IMPORT_SCROLL_END_TOLERANCE_PX,
  SITE_IMPORT_SKELETON_KEYS,
} from "@/constants/site-create";
import { useIsRefreshingImportableRepositories } from "@/lib/hooks/use-importable-repositories";
import { useSiteGitHubInstall } from "@/lib/hooks/use-site-github-install";
import { cn } from "@/lib/utils";
import type {
  SiteImportListProps,
  SiteImportOwnerPickerProps,
  SiteImportRepositoryRowProps,
} from "@/types/components/sites";
import {
  isCurrentSiteRepository,
  visibleSiteImportRepositories,
} from "@/utils/site-import-repositories";

function githubAvatarUrl(owner: string) {
  return `https://github.com/${encodeURIComponent(owner)}.png?size=64`;
}

function OwnerAvatar({
  owner,
  className,
}: {
  owner: string;
  className: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage alt="" src={githubAvatarUrl(owner)} />
      <AvatarFallback>{owner.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}

function SiteImportRepositoryRow({
  repository,
  isCurrent,
  importingId,
  onImport,
  actionLabel,
  actionAriaLabel,
}: SiteImportRepositoryRowProps) {
  const t = useTranslations("sites.new");
  const tSettings = useTranslations("sites.settings");
  const isImporting = repository.githubRepositoryId === importingId;
  return (
    <li className="flex h-14 items-center gap-3 px-3">
      <OwnerAvatar className="size-8 shrink-0" owner={repository.owner} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm">
          <span className="text-muted-foreground">{repository.owner}/</span>
          <span className="font-medium">{repository.repo}</span>
        </span>
        {repository.private ? (
          <HugeiconsIcon
            aria-label={t("private")}
            className="text-muted-foreground shrink-0"
            icon={SquareLock02Icon}
            role="img"
            size={12}
          />
        ) : null}
      </span>
      {isCurrent ? (
        <Badge variant="secondary">{tSettings("currentRepository")}</Badge>
      ) : (
        <Button
          aria-label={
            actionAriaLabel?.(repository.repo) ??
            t("importRepository", { repository: repository.repo })
          }
          disabled={importingId !== null && !isImporting}
          loading={isImporting}
          onClick={() => onImport(repository)}
          size="sm"
        >
          {actionLabel ?? t("import")}
        </Button>
      )}
    </li>
  );
}

function SiteImportOwnerPicker({
  owners,
  activeOwner,
  onChange,
}: SiteImportOwnerPickerProps) {
  const t = useTranslations("sites.new");
  if (owners.length <= 1) {
    return activeOwner ? (
      <span className="bg-muted/30 flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-sm">
        <OwnerAvatar className="size-5" owner={activeOwner} />
        <span className="max-w-32 truncate">{activeOwner}</span>
      </span>
    ) : null;
  }
  return (
    <Select
      onValueChange={(value: string | null) => onChange(value)}
      value={activeOwner}
    >
      <SelectTrigger aria-label={t("account")} className="w-48 shrink-0">
        <SelectValue>
          {(value: string | null) =>
            value ? (
              <span className="flex min-w-0 items-center gap-2">
                <OwnerAvatar className="size-5" owner={value} />
                <span className="truncate">{value}</span>
              </span>
            ) : null
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {owners.map((name) => (
          <SelectItem key={name} value={name}>
            <span className="flex items-center gap-2">
              <OwnerAvatar className="size-5" owner={name} />
              {name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SiteImportList({
  organizationId,
  organizationSlug,
  repositories,
  accounts = [],
  installed,
  isLoading: isLoadingRepositories,
  loadFailed,
  onRetry,
  importingId,
  onImport,
  callbackPath,
  actionLabel,
  actionAriaLabel,
  currentRepository = null,
}: SiteImportListProps) {
  const t = useTranslations("sites.new");
  // Linked accounts without any granted repository stay selectable so their access can be adjusted.
  const owners = [
    ...new Set([
      ...accounts.map((account) => account.login),
      ...repositories.map((repository) => repository.owner),
    ]),
  ];
  const [owner, setOwner] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const { installing, install } = useSiteGitHubInstall({
    organizationId,
    callbackPath: callbackPath ?? `/${organizationSlug}/sites/new`,
  });
  const isLoading =
    useIsRefreshingImportableRepositories(organizationId) ||
    isLoadingRepositories;
  const listRef = useRef<HTMLUListElement>(null);
  const activeOwner = owner ?? owners[0] ?? null;
  const activeAccount = accounts.find(
    (account) => account.login.toLowerCase() === activeOwner?.toLowerCase()
  );
  const visible = visibleSiteImportRepositories({
    repositories,
    currentRepository,
    owner: activeOwner,
    search,
  });

  const updateFade = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    setHasMoreBelow(
      list.scrollHeight - list.scrollTop - list.clientHeight >
        SITE_IMPORT_SCROLL_END_TOLERANCE_PX
    );
  }, []);

  useEffect(() => {
    updateFade();
  }, [updateFade, visible.length, isLoading]);

  if (loadFailed && !installed) {
    return (
      <EmptyState
        action={
          <Button onClick={onRetry} variant="secondary">
            {t("repositoriesRetry")}
          </Button>
        }
        className="min-h-0 py-12"
        description={t("repositoriesLoadFailedDescription")}
        illustration={<SadCapybara />}
        title={t("repositoriesLoadFailedTitle")}
      />
    );
  }

  if (!(isLoading || installed)) {
    return (
      <EmptyState
        action={
          <Button loading={installing} onClick={install}>
            <HugeiconsIcon data-icon="inline-start" icon={Github01Icon} />
            {t("installGitHub")}
          </Button>
        }
        className="min-h-0 py-12"
        description={t("installDescription")}
        title={t("installTitle")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <SiteImportOwnerPicker
          activeOwner={activeOwner}
          onChange={setOwner}
          owners={owners}
        />
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <HugeiconsIcon
              aria-hidden="true"
              icon={Search01Icon}
              size={14}
              strokeWidth={1.5}
            />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("searchRepositories")}
            autoCapitalize="none"
            autoComplete="off"
            disabled={isLoading}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchRepositories")}
            spellCheck={false}
            type="search"
            value={search}
          />
        </InputGroup>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <ul
          className={cn(
            "max-h-[22.5rem] divide-y overflow-y-auto overscroll-contain",
            hasMoreBelow &&
              "mask-[linear-gradient(to_bottom,black_calc(100%-4rem),transparent_100%)]"
          )}
          onScroll={updateFade}
          ref={listRef}
        >
          {isLoading
            ? SITE_IMPORT_SKELETON_KEYS.map((key) => (
                <li className="flex h-14 items-center gap-3 px-3" key={key}>
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-3.5 w-48 rounded-sm" />
                </li>
              ))
            : visible.map((repository) => (
                <SiteImportRepositoryRow
                  actionAriaLabel={actionAriaLabel}
                  actionLabel={actionLabel}
                  importingId={importingId}
                  isCurrent={isCurrentSiteRepository(
                    repository,
                    currentRepository
                  )}
                  key={repository.githubRepositoryId}
                  onImport={onImport}
                  repository={repository}
                />
              ))}
          {!isLoading && visible.length === 0 ? (
            <li className="text-muted-foreground px-3 py-8 text-center text-sm">
              {t("noRepositoryMatch")}
            </li>
          ) : null}
        </ul>
      </div>
      <SiteImportAccessActions
        account={activeAccount}
        installing={installing}
        onInstall={install}
        organizationId={organizationId}
      />
    </div>
  );
}
