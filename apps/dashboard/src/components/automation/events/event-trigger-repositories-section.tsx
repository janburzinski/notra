import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@notra/ui/components/ui/combobox";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { useTranslations } from "use-intl";

import {
  EditorBox,
  EditorPad,
  EditorRow,
  EditorSection,
} from "@/components/automation/editor/editor-parts";
import { AddRepositoryButton } from "@/components/integrations/add-repository-button";
import type { EventTriggerRepositoriesSectionProps } from "@/types/automation/event-trigger";

export function EventTriggerRepositoriesSection({
  form,
  isLoading,
  options,
  onAddRepository,
}: EventTriggerRepositoriesSectionProps) {
  const t = useTranslations("automation.events.dialog");
  const tCommon = useTranslations("common");
  const comboboxAnchor = useComboboxAnchor();

  return (
    <EditorSection
      hint={t("repositoriesHint")}
      label={
        <>
          {tCommon("labels.repositories")}{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </>
      }
    >
      <EditorBox>
        {!isLoading && options.length === 0 ? (
          <EditorRow action={<AddRepositoryButton onAdd={onAddRepository} />}>
            <span className="flex items-center gap-2">
              <Github className="text-foreground size-4 shrink-0" />
              {t("noRepositories")}
            </span>
          </EditorRow>
        ) : (
          <EditorPad>
            {isLoading && <Skeleton className="h-10 w-full" />}
            {!isLoading && options.length > 0 && (
              <form.Field name="repositoryIds">
                {(field) => (
                  <div ref={comboboxAnchor}>
                    <Combobox
                      items={options.map((o) => o.value)}
                      multiple
                      onValueChange={(value) =>
                        field.handleChange(Array.isArray(value) ? value : [])
                      }
                      value={field.state.value}
                    >
                      <ComboboxChips>
                        {field.state.value.map((id) => {
                          const opt = options.find((o) => o.value === id);
                          if (!opt) {
                            return null;
                          }
                          return (
                            <ComboboxChip
                              className="max-w-full"
                              key={opt.value}
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Github className="size-3 shrink-0" />
                                <span className="truncate" title={opt.label}>
                                  {opt.label}
                                </span>
                              </span>
                            </ComboboxChip>
                          );
                        })}
                        <ComboboxChipsInput
                          placeholder={tCommon("labels.searchRepositories")}
                        />
                      </ComboboxChips>
                      <ComboboxContent anchor={comboboxAnchor.current}>
                        <ComboboxEmpty>
                          {tCommon("labels.noRepositoriesFound")}
                        </ComboboxEmpty>
                        <ComboboxList>
                          {options.map((opt) => (
                            <ComboboxItem key={opt.value} value={opt.value}>
                              <span className="flex min-w-0 items-center gap-2">
                                <Github className="size-3.5 shrink-0" />
                                <span className="truncate" title={opt.label}>
                                  {opt.label}
                                </span>
                              </span>
                            </ComboboxItem>
                          ))}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                )}
              </form.Field>
            )}
          </EditorPad>
        )}
      </EditorBox>
    </EditorSection>
  );
}
