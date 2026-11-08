import interCyrillic400 from "@fontsource/inter/files/inter-cyrillic-400-normal.woff?inline";
import interCyrillic500 from "@fontsource/inter/files/inter-cyrillic-500-normal.woff?inline";
import interCyrillic600 from "@fontsource/inter/files/inter-cyrillic-600-normal.woff?inline";
import interCyrillic700 from "@fontsource/inter/files/inter-cyrillic-700-normal.woff?inline";
import interGreek400 from "@fontsource/inter/files/inter-greek-400-normal.woff?inline";
import interGreek500 from "@fontsource/inter/files/inter-greek-500-normal.woff?inline";
import interGreek600 from "@fontsource/inter/files/inter-greek-600-normal.woff?inline";
import interGreek700 from "@fontsource/inter/files/inter-greek-700-normal.woff?inline";
import interLatin400 from "@fontsource/inter/files/inter-latin-400-normal.woff?inline";
import interLatin500 from "@fontsource/inter/files/inter-latin-500-normal.woff?inline";
import interLatin600 from "@fontsource/inter/files/inter-latin-600-normal.woff?inline";
import interLatin700 from "@fontsource/inter/files/inter-latin-700-normal.woff?inline";
import interLatinExt400 from "@fontsource/inter/files/inter-latin-ext-400-normal.woff?inline";
import interLatinExt500 from "@fontsource/inter/files/inter-latin-ext-500-normal.woff?inline";
import interLatinExt600 from "@fontsource/inter/files/inter-latin-ext-600-normal.woff?inline";
import interLatinExt700 from "@fontsource/inter/files/inter-latin-ext-700-normal.woff?inline";

/**
 * Inter as data URLs, keyed by `OG_FONT_FILES` file name. Inlined because the
 * server bundle has no node_modules to read font files from.
 */
export const SITE_SHARE_IMAGE_FONT_DATA: Record<string, string> = {
  "inter-latin-400-normal.woff": interLatin400,
  "inter-latin-500-normal.woff": interLatin500,
  "inter-latin-600-normal.woff": interLatin600,
  "inter-latin-700-normal.woff": interLatin700,
  "inter-latin-ext-400-normal.woff": interLatinExt400,
  "inter-latin-ext-500-normal.woff": interLatinExt500,
  "inter-latin-ext-600-normal.woff": interLatinExt600,
  "inter-latin-ext-700-normal.woff": interLatinExt700,
  "inter-cyrillic-400-normal.woff": interCyrillic400,
  "inter-cyrillic-500-normal.woff": interCyrillic500,
  "inter-cyrillic-600-normal.woff": interCyrillic600,
  "inter-cyrillic-700-normal.woff": interCyrillic700,
  "inter-greek-400-normal.woff": interGreek400,
  "inter-greek-500-normal.woff": interGreek500,
  "inter-greek-600-normal.woff": interGreek600,
  "inter-greek-700-normal.woff": interGreek700,
};
