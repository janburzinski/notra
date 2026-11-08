"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";

import { SITE_AUTHOR_NEW_PARAM } from "@/constants/site-authors";
import type { SiteAuthorEntry } from "@/types/site-authors";

/** The editor dialog, open for a new author with `?author=new`. */
export function useSiteAuthorEditor() {
  const [authorParam, setAuthorParam] = useQueryState("author", parseAsString);
  const [editing, setEditing] = useState<SiteAuthorEntry | "new" | null>(
    authorParam === SITE_AUTHOR_NEW_PARAM ? "new" : null
  );
  return {
    editing,
    open: setEditing,
    close: () => {
      setEditing(null);
      if (authorParam) {
        void setAuthorParam(null);
      }
    },
  };
}
