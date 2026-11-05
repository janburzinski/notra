import { BLOG_CHROME_CSS_PROPERTY_RULE } from "@/constants/blog-chrome";

// Shadow roots ignore @property rules, so the page registers them instead.
export function shadowSheet(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    css.replace(BLOG_CHROME_CSS_PROPERTY_RULE, "").replaceAll(":root", ":host")
  );
  return sheet;
}

export function documentRules(css: string): string {
  return (css.match(BLOG_CHROME_CSS_PROPERTY_RULE) ?? []).join("\n");
}
