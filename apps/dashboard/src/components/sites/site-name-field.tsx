"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useForm, useStore } from "@tanstack/react-form";
import { useTranslations } from "use-intl";

import { useSite } from "@/components/sites/site-context";
import { SITE_NAME_MAX_LENGTH } from "@/constants/sites-form";
import { useUpdateSiteSettings } from "@/lib/hooks/use-update-site-settings";
import { useRouter } from "@/lib/navigation";

export function SiteNameField() {
  const tNew = useTranslations("sites.new");
  const tCommon = useTranslations("common");
  const { site } = useSite().detail;
  const router = useRouter();
  const save = useUpdateSiteSettings();
  const form = useForm({
    defaultValues: { name: site.name },
    onSubmit: ({ value }) => {
      const name = value.name.trim();
      if (name.length > 0 && name !== site.name && !save.isPending) {
        save.mutate(
          { name },
          {
            onSuccess: () => {
              form.reset();
              // Re-runs the site loader so the tab title shows the new name.
              return router.refresh();
            },
          }
        );
      }
    },
  });
  const next = useStore(form.store, (state) => state.values.name.trim());
  const dirty = next.length > 0 && next !== site.name;
  const submit = () => {
    if (dirty && !save.isPending) {
      form.handleSubmit();
    }
  };
  return (
    <form className="w-full sm:w-64 sm:shrink-0" action={submit}>
      <form.Field name="name">
        {(field) => (
          <InputGroup>
            <InputGroupInput
              aria-label={tNew("name")}
              readOnly={save.isPending}
              maxLength={SITE_NAME_MAX_LENGTH}
              onBlur={() => {
                if (next.length === 0) {
                  form.reset();
                  return;
                }
                submit();
              }}
              onChange={(event) => field.handleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  form.reset();
                }
              }}
              value={field.state.value}
            />
            {dirty || save.isPending ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  loading={save.isPending}
                  onClick={submit}
                  variant="secondary"
                >
                  {tCommon("actions.save")}
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        )}
      </form.Field>
    </form>
  );
}
