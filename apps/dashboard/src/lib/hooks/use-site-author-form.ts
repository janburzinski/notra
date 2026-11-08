"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useRef } from "react";

import type {
  SiteAuthorEntry,
  SiteAuthorForm,
  SiteAuthorFormErrors,
} from "@/types/site-authors";
import { authorSlugBase } from "@/utils/content-authors";
import {
  siteAuthorForm,
  siteAuthorFromForm,
  validateSiteAuthorForm,
} from "@/utils/site-authors";

/** The author form's values, and its errors once a save was attempted. */
export function useSiteAuthorForm(
  entry: SiteAuthorEntry | null,
  takenIds: ReadonlySet<string>,
  onSubmit: (saved: SiteAuthorEntry) => void
) {
  const form = useForm({
    defaultValues: siteAuthorForm(entry),
    onSubmit: ({ value }) => {
      if (Object.keys(validateSiteAuthorForm(value, takenIds)).length === 0) {
        onSubmit(siteAuthorFromForm(value));
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const showErrors = useStore(
    form.store,
    (state) => state.submissionAttempts > 0
  );
  // A new author's id follows the name until it's edited by hand.
  const idEdited = useRef(Boolean(entry));
  const set = (key: keyof SiteAuthorForm, value: string) =>
    form.setFieldValue(key, value);
  const errors: SiteAuthorFormErrors = showErrors
    ? validateSiteAuthorForm(values, takenIds)
    : {};
  return {
    values,
    set,
    setName: (name: string) => {
      set("name", name);
      if (!idEdited.current) {
        set("id", authorSlugBase(name));
      }
    },
    setId: (id: string) => {
      idEdited.current = true;
      set("id", id.toLowerCase());
    },
    errors,
    submit: () => form.handleSubmit(),
  };
}
