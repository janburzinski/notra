"use client";

import { useRef, useState } from "react";

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
  takenIds: ReadonlySet<string>
) {
  const [form, setForm] = useState<SiteAuthorForm>(() => siteAuthorForm(entry));
  const [showErrors, setShowErrors] = useState(false);
  // A new author's id follows the name until it's edited by hand.
  const idEdited = useRef(Boolean(entry));
  const errors = validateSiteAuthorForm(form, takenIds);
  const set = (patch: Partial<SiteAuthorForm>) =>
    setForm((current) => ({ ...current, ...patch }));
  return {
    form,
    set,
    setName: (name: string) =>
      set(idEdited.current ? { name } : { name, id: authorSlugBase(name) }),
    setId: (id: string) => {
      idEdited.current = true;
      set({ id: id.toLowerCase() });
    },
    errors: (showErrors ? errors : {}) as SiteAuthorFormErrors,
    /** The entry to save, or null after revealing the errors that block it. */
    submit: (): SiteAuthorEntry | null => {
      if (Object.keys(errors).length > 0) {
        setShowErrors(true);
        return null;
      }
      return siteAuthorFromForm(form);
    },
  };
}
