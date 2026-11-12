"use client";

import {
  Link04Icon,
  PlusSignIcon,
  Refresh03Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Separator } from "@notra/ui/components/ui/separator";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { EmptyStateCardsPreview } from "@/components/empty-state-preview";
import { PageContainer } from "@/components/layout/container";
import { SkillCard } from "@/components/skills/skill-card";
import { EMPTY_STATE_CARD_COUNT } from "@/constants/empty-state";
import { SKILL_SORT_KEYS } from "@/constants/skills";
import { dashboardOrpc } from "@/lib/orpc/query";
import { parseSkillFrontmatter } from "@/lib/skills/parse-frontmatter";
import { cn } from "@/lib/utils";
import { createSkillFormSchema } from "@/schemas/skill-form";
import type {
  CreateSkillFormDialogProps,
  SkillDraftValues,
  SkillListItem,
  SkillSortKey,
  SkillSortState,
  SkillsPageClientProps,
} from "@/types/skills/page";
import {
  filterSkills,
  skillQuickstartError,
  sortSkills,
  toggleSkillSort,
} from "@/utils/skills";

import { SkillsPageSkeleton } from "./skeleton";

export default function PageClient({
  slug,
  organizationId,
}: SkillsPageClientProps) {
  const t = useTranslations("skills");
  const tCommon2 = useTranslations("common");
  const tValidation = useTranslations("skills.validation");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SkillSortState>({
    key: "name",
    direction: "asc",
  });

  useHotkey("C", () => setDialogOpen(true), { enabled: !dialogOpen });

  const {
    data: skills = [],
    isPending,
    isError,
    refetch,
  } = useQuery(
    dashboardOrpc.skills.list.queryOptions({
      input: { organizationId },
    })
  );

  const visibleSkills = sortSkills(filterSkills(skills, search), sort);
  const searchActive = search.trim().length > 0;

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon2("labels.skills")}
        >
          <Button
            className="w-fit"
            onClick={() => setDialogOpen(true)}
            size="sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
              {t("createSkill")}
            </span>
            <Kbd className="hidden sm:inline-flex">C</Kbd>
          </Button>
        </PageHeading>

        <SkillsPageBody
          isError={isError}
          isPending={isPending}
          onCreate={() => setDialogOpen(true)}
          onRetry={() => {
            refetch().catch(() => undefined);
          }}
          onSearchChange={setSearch}
          onSortChange={setSort}
          search={search}
          searchActive={searchActive}
          skills={skills}
          slug={slug}
          sort={sort}
          visibleSkills={visibleSkills}
        />
      </div>

      <CreateSkillFormDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        organizationId={organizationId}
      />
    </PageContainer>
  );
}

function SkillsPageBody({
  isError,
  isPending,
  onCreate,
  onRetry,
  onSearchChange,
  onSortChange,
  search,
  searchActive,
  skills,
  slug,
  sort,
  visibleSkills,
}: {
  isError: boolean;
  isPending: boolean;
  onCreate: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: SkillSortState) => void;
  search: string;
  searchActive: boolean;
  skills: SkillListItem[];
  slug: string;
  sort: SkillSortState;
  visibleSkills: SkillListItem[];
}) {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");
  if (isPending) {
    return <SkillsPageSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        actionIcon={<HugeiconsIcon className="size-4" icon={Refresh03Icon} />}
        actionLabel={tCommon("actions.retry")}
        description={t("loadError.description")}
        onActionClick={onRetry}
        title={t("loadError.title")}
      />
    );
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        action={
          <Button onClick={onCreate} variant="outline">
            <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
            {t("createSkill")}
          </Button>
        }
        description={t("empty.description")}
        preview={
          <EmptyStateCardsPreview
            columns={3}
            count={EMPTY_STATE_CARD_COUNT.skill}
            variant="skill"
          />
        }
        title={tCommon("labels.noSkillsYet")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          {t("installed")}{" "}
          <span className="text-muted-foreground tabular-nums">
            {searchActive
              ? t("countFiltered", {
                  visible: visibleSkills.length,
                  total: skills.length,
                })
              : t("count", { total: skills.length })}
          </span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SkillSortControl onSortChange={onSortChange} sort={sort} />
          <InputGroup className="h-9 sm:max-w-72">
            <InputGroupAddon>
              <HugeiconsIcon
                className="text-muted-foreground size-4"
                icon={Search01Icon}
              />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("search.label")}
              autoComplete="off"
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("search.placeholder")}
              value={search}
            />
          </InputGroup>
        </div>
      </div>
      {visibleSkills.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Search01Icon} />
            </EmptyMedia>
            <EmptyTitle>{t("table.noSearchResults")}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() => onSearchChange("")}
              size="sm"
              variant="outline"
            >
              {tCommon("actions.clear")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSkills.map((skill) => (
            <li className="min-w-0" key={skill.id}>
              <SkillCard skill={skill} slug={slug} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillSortControl({
  sort,
  onSortChange,
}: {
  sort: SkillSortState;
  onSortChange: (sort: SkillSortState) => void;
}) {
  const t = useTranslations("skills.sort");
  const tCommon = useTranslations("common");
  const labels: Record<SkillSortKey, string> = {
    name: tCommon("labels.name"),
    type: tCommon("labels.type"),
    updatedAt: tCommon("labels.updated"),
  };

  return (
    <div
      aria-label={t("label")}
      className="bg-muted inline-flex w-fit items-center rounded-lg p-0.5"
      role="group"
    >
      {SKILL_SORT_KEYS.map((key) => {
        const selected = sort.key === key;
        const label = labels[key];
        return (
          <button
            aria-label={
              selected
                ? t("selected", {
                    field: label,
                    direction:
                      sort.direction === "asc"
                        ? t("ascending")
                        : t("descending"),
                  })
                : label
            }
            aria-pressed={selected}
            className={cn(
              "focus-visible:ring-ring/50 duration-fast inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ease-out focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={key}
            onClick={() => onSortChange(toggleSkillSort(sort, key))}
            type="button"
          >
            {label}
            {selected ? (
              <span aria-hidden="true">
                {sort.direction === "asc" ? "↑" : "↓"}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function CreateSkillFormDialog({
  onOpenChange,
  open,
  organizationId,
}: CreateSkillFormDialogProps) {
  const t = useTranslations("skills.create");
  const tSkills = useTranslations("skills");
  const tSkillsShared = useTranslations("skills.shared");
  const tValidation = useTranslations("skills.validation");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      quickstartUrl: "",
      name: "",
      description: "",
      content: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value).catch(() => undefined);
    },
  });

  const fillEmptyFields = (values: SkillDraftValues) => {
    const keys: (keyof SkillDraftValues)[] = ["name", "description", "content"];
    for (const key of keys) {
      if (!form.getFieldValue(key)) {
        form.setFieldValue(key, values[key]);
      }
    }
  };

  const importMutation = useMutation({
    mutationFn: () =>
      dashboardOrpc.skills.importFromUrl.call({
        url: form.getFieldValue("quickstartUrl").trim(),
      }),
    onSuccess: (data) => {
      fillEmptyFields(data);
      toast.success(tSkills("toasts.imported"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: SkillDraftValues) => {
      if (!organizationId) {
        throw new Error(tCommon2("labels.organizationIdIsRequired"));
      }
      const parsed = createSkillFormSchema(tValidation, tCommon2).safeParse(
        values
      );
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues[0]?.message ?? tValidation("invalidInput")
        );
      }
      return dashboardOrpc.skills.create.call({
        organizationId,
        payload: parsed.data,
      });
    },
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.skills.list.queryKey({
          input: { organizationId },
        }),
      });
      toast.success(tSkills("toasts.created"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onPasteFrontmatter = (
    e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const parsed = parseSkillFrontmatter(e.clipboardData.getData("text/plain"));
    if (!parsed) {
      return;
    }

    e.preventDefault();
    fillEmptyFields({
      name: parsed.name ?? "",
      description: parsed.description ?? "",
      content: parsed.body,
    });
  };

  const createPending = createMutation.isPending;
  const importPending = importMutation.isPending;
  const onImport = () => importMutation.mutate();

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:max-w-[32rem]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {tSkillsShared("createSkill")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="-mx-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">
          <form.Field name="quickstartUrl">
            {(field) => {
              const quickstartUrl = field.state.value;
              const quickstartError = skillQuickstartError(quickstartUrl);
              return (
                <Field>
                  <FieldLabel>{t("quickstart")}</FieldLabel>
                  <InputGroup className="h-9">
                    <InputGroupAddon>
                      <HugeiconsIcon
                        className="text-muted-foreground size-4"
                        icon={Link04Icon}
                      />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-invalid={quickstartError ? true : undefined}
                      disabled={createPending || importPending}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !(e.metaKey || e.ctrlKey) &&
                          !quickstartError &&
                          quickstartUrl.trim() &&
                          !importPending
                        ) {
                          e.preventDefault();
                          onImport();
                        }
                      }}
                      placeholder="https://skills.sh/..."
                      value={quickstartUrl}
                    />
                    <InputGroupAddon align="inline-end" className="pr-1">
                      <Button
                        className="h-7 px-2.5"
                        disabled={
                          !quickstartUrl.trim() ||
                          !!quickstartError ||
                          createPending
                        }
                        loading={importPending}
                        onClick={onImport}
                        size="sm"
                      >
                        {tCommon2("actions.import")}
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                  <p
                    className={
                      quickstartError
                        ? "text-destructive text-xs"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {quickstartError
                      ? t(`quickstartErrors.${quickstartError}`)
                      : t("quickstartHint")}
                  </p>
                </Field>
              );
            }}
          </form.Field>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs tracking-wider uppercase">
              {t("orManually")}
            </span>
            <Separator className="flex-1" />
          </div>
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel>
                  {tCommon2("labels.name")}
                  <span className="text-destructive -ml-1">*</span>
                </FieldLabel>
                <Input
                  disabled={createPending}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onPaste={onPasteFrontmatter}
                  placeholder="my-skill"
                  value={field.state.value}
                />
                <p className="text-muted-foreground text-xs">{t("nameHint")}</p>
              </Field>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <Field>
                <FieldLabel>
                  {tCommon2("labels.description")}
                  <span className="text-destructive -ml-1">*</span>
                </FieldLabel>
                <Textarea
                  className="max-h-[5rem] min-h-[4rem] overflow-y-auto"
                  disabled={createPending}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onPaste={onPasteFrontmatter}
                  placeholder={t("descriptionPlaceholder")}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="content">
            {(field) => (
              <Field>
                <FieldLabel>
                  {tCommon2("labels.contentSingular")}
                  <span className="text-destructive -ml-1">*</span>
                </FieldLabel>
                <Textarea
                  className="max-h-[14rem] min-h-[10rem] overflow-y-auto font-mono text-sm"
                  disabled={createPending}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onPaste={onPasteFrontmatter}
                  placeholder={t("contentPlaceholder")}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
        </div>
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose
            disabled={createPending}
            render={<Button variant="outline">{tCommon("cancel")}</Button>}
          />
          <Button
            data-dialog-confirm
            disabled={createPending}
            onClick={() => form.handleSubmit()}
          >
            {createPending ? tCommon("creating") : tSkillsShared("createSkill")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
