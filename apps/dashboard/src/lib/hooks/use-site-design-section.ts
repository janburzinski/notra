import { parseAsString, useQueryState } from "nuqs";

import { SITE_DESIGN_SECTIONS } from "@/constants/site-design-sections";
export function useSiteDesignSection() {
  const [selected, setSection] = useQueryState(
    "section",
    parseAsString.withDefault("general")
  );
  return {
    active:
      SITE_DESIGN_SECTIONS.find((section) => section.id === selected) ??
      SITE_DESIGN_SECTIONS[0],
    select: (next: string) => {
      void setSection(next);
    },
  };
}
