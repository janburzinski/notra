import {
  Globe02Icon,
  Image01Icon,
  Menu01Icon,
  PaintBoardIcon,
  Plug01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";

/** The Design tab's sections, in sidebar order, with the blog.json paths each one edits. */
export const SITE_DESIGN_SECTIONS = [
  { id: "general", icon: Globe02Icon, paths: ["name", "description"] },
  {
    id: "styling",
    icon: PaintBoardIcon,
    paths: ["colors", "appearance", "background", "styling.codeblocks"],
  },
  { id: "branding", icon: Image01Icon, paths: ["logo", "favicon"] },
  { id: "typography", icon: TextFontIcon, paths: ["fonts"] },
  { id: "navbar", icon: Menu01Icon, paths: ["navbar"] },
  { id: "integrations", icon: Plug01Icon, paths: ["integrations"] },
] as const;
