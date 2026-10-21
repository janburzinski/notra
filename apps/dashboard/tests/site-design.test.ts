import { describe, expect, test } from "bun:test";

import { SITE_NAVBAR_LINK_TYPES } from "@notra/sites-core/constants/site-layout";

import {
  SITE_APPEARANCE_MODES,
  SITE_BACKGROUND_DECORATIONS,
} from "../src/constants/site-design";
import type { BrandGuidelinesResponse } from "../src/types/hooks/brand-guidelines";
import type { SiteDesignForm, SiteRawConfig } from "../src/types/site-design";
import {
  applyBrandToDesign,
  brandDefaultsFromGuidelines,
  describeBrandForDesign,
  patchDesign,
  readDesignForm,
  siteConfigIssue,
} from "../src/utils/site-design";

const SOURCE: SiteRawConfig = {
  $schema: "https://usenotra.com/schema/blog.json",
  name: "Acme",
  description: "Product updates",
  logo: "/logo.svg",
  colors: { primary: "#112233" },
  navbar: {
    areas: [{ area: "blog" }],
    links: [
      {
        label: "Products",
        items: [{ label: "Flow", href: "https://acme.com/flow" }],
      },
      { label: "Docs", href: "https://acme.com/docs", icon: "book-open" },
      { type: "github", href: "https://github.com/acme" },
      { label: "Pricing", href: "/pricing" },
    ],
    cta: { label: "Sign up", href: "/signup", icon: "rocket" },
  },
  appearance: { default: "system", strict: false, storageKey: "acme-theme" },
  styling: { codeblocks: "system", future: "kept" },
  background: { decoration: "none", future: "kept" },
  integrations: { plausible: { domain: "acme.com" } },
  custom: { future: true },
};

const EMPTY_FONT = { family: "", weight: "", source: "", format: "" } as const;

type FormPatch = Partial<SiteDesignForm>;

/** Every form shape the design page can produce, one dimension at a time. */
const VARIANTS: [string, FormPatch][] = [
  ["general", { name: "Acme Blog", description: "" }],
  ["shared logo with link", { logoLight: "/brand.svg", logoHref: "/home" }],
  [
    "separate logos",
    { separateLogos: true, logoLight: "/l.svg", logoDark: "/d.svg" },
  ],
  ["no logo", { logoLight: "", logoHref: "" }],
  ["shared favicon", { faviconLight: "/favicon.svg" }],
  [
    "separate favicons",
    { separateFavicons: true, faviconLight: "/f.png", faviconDark: "/fd.png" },
  ],
  [
    "colors",
    { primary: "#AABBCC", darkModeAccent: "#DDEEFF", button: "#000000" },
  ],
  [
    "background colors and shared image",
    {
      backgroundLight: "#FAFAFA",
      backgroundDark: "#0A0A0A",
      backgroundImageLight: "/bg.png",
    },
  ],
  [
    "separate background images",
    {
      separateBackgroundImages: true,
      backgroundImageLight: "/bg.png",
      backgroundImageDark: "/bg-dark.png",
    },
  ],
  ...SITE_BACKGROUND_DECORATIONS.map((decoration): [string, FormPatch] => [
    `decoration ${decoration}`,
    { decoration },
  ]),
  ...SITE_APPEARANCE_MODES.flatMap((appearance) =>
    [true, false].map((showModeToggle): [string, FormPatch] => [
      `appearance ${appearance}, toggle ${showModeToggle}`,
      { appearance, showModeToggle },
    ])
  ),
  ["code dark", { codeMode: "dark" }],
  [
    "code custom pair",
    { codeMode: "custom", codeLight: "min-light", codeDark: "nord" },
  ],
  [
    "code custom single",
    { codeMode: "custom", codeLight: "vitesse-dark", codeDark: "vitesse-dark" },
  ],
  [
    "single google font",
    { font: { ...EMPTY_FONT, family: "Geist", weight: "500" } },
  ],
  ["single weight only", { font: { ...EMPTY_FONT, weight: "300" } }],
  [
    "single self-hosted woff",
    {
      font: {
        family: "Brand",
        weight: "",
        source: "/fonts/brand.woff",
        format: "woff",
      },
    },
  ],
  [
    "pair fonts, self-hosted heading",
    {
      typographyMode: "pair",
      heading: {
        family: "Display",
        weight: "700",
        source: "https://cdn.acme.com/display.woff2",
        format: "woff2",
      },
      body: { ...EMPTY_FONT, family: "Inter" },
    },
  ],
  [
    "pair with heading only",
    {
      typographyMode: "pair",
      heading: { ...EMPTY_FONT, family: "Fraunces" },
    },
  ],
  ["navbar without button", { navbarButton: "none" }],
  [
    "navbar button",
    {
      navbarButton: "button",
      navbarButtonLabel: "Start",
      navbarButtonHref: "https://acme.com/start",
    },
  ],
  ...SITE_NAVBAR_LINK_TYPES.map((type): [string, FormPatch] => [
    `navbar ${type} button`,
    { navbarButton: type, navbarButtonHref: `https://${type}.com/acme` },
  ]),
];

/** Hidden fields keep their old values in the form but aren't written. */
function written(form: SiteDesignForm): SiteDesignForm {
  return {
    ...form,
    navbarButtonLabel:
      form.navbarButton === "button" ? form.navbarButtonLabel : "",
    navbarButtonHref: form.navbarButton === "none" ? "" : form.navbarButtonHref,
    font: form.typographyMode === "pair" ? EMPTY_FONT : form.font,
  };
}

function variant(patch: FormPatch) {
  const initial = readDesignForm(SOURCE);
  const form = { ...initial, ...patch };
  const config = patchDesign(SOURCE, form, initial);
  return { initial, form, config };
}

describe("site design form", () => {
  test.each(VARIANTS)(
    "%s writes valid blog.json that reads back",
    (_, patch) => {
      const { form, config } = variant(patch);
      expect(siteConfigIssue(config)).toBeNull();
      expect(readDesignForm(config)).toEqual(written(form));
    }
  );

  test.each(VARIANTS)("%s leaves the other sections untouched", (_, patch) => {
    const { config } = variant(patch);
    for (const key of ["$schema", "integrations", "custom", "colors"]) {
      if (!(key === "colors" && "primary" in patch)) {
        expect(config[key]).toEqual(SOURCE[key]);
      }
    }
    expect((config.styling as SiteRawConfig).future).toBe("kept");
    expect((config.background as SiteRawConfig).future).toBe("kept");
    expect((config.appearance as SiteRawConfig).storageKey).toBe("acme-theme");
  });

  test("a self-hosted font gets its format from the file name", () => {
    const { config } = variant({
      font: { ...EMPTY_FONT, family: "Brand", source: "/fonts/brand.woff?v=2" },
    });
    expect(config.fonts).toEqual({
      family: "Brand",
      source: "/fonts/brand.woff?v=2",
      format: "woff",
    });
  });

  test.each(["body", "heading"] as const)(
    "editing the %s weight preserves root fonts and the inherited role",
    (role) => {
      const fonts = {
        family: "Fraunces",
        weight: 400,
        source: "/fonts/fraunces.woff2",
        format: "woff2",
        [role]: { family: "Inter", weight: 400 },
      };
      const source = { ...SOURCE, fonts };
      const initial = readDesignForm(source);
      const form = {
        ...initial,
        [role]: { ...initial[role], weight: "600" },
      };
      const config = patchDesign(source, form, initial);
      expect(siteConfigIssue(config)).toBeNull();
      expect(config.fonts).toEqual({
        ...fonts,
        [role]: { family: "Inter", weight: 600 },
      });
    }
  );

  test("hex colors are uppercased and paths trimmed", () => {
    const { config } = variant({
      primary: "#abc",
      logoLight: " /logo.svg ",
      name: " Acme ",
    });
    expect(config.colors).toEqual({ primary: "#ABC" });
    expect(config.logo).toBe("/logo.svg");
    expect(config.name).toBe("Acme");
  });

  test("editing navbar links keeps icons, dropdowns and platform links in place", () => {
    const initial = readDesignForm(SOURCE);
    expect(initial.navbarLinks.map((link) => link.label)).toEqual([
      "Docs",
      "Pricing",
    ]);
    const [docs, pricing] = initial.navbarLinks;
    if (!(docs && pricing)) {
      throw new Error("expected two plain links");
    }
    const form: SiteDesignForm = {
      ...initial,
      navbarLinks: [
        { ...docs, label: "Guides" },
        { ...pricing, label: "  ", href: "" },
        { id: "new", label: "Blog", href: "/blog" },
      ],
    };
    const navbar = patchDesign(SOURCE, form, initial).navbar as SiteRawConfig;
    expect(navbar.links).toEqual([
      {
        label: "Products",
        items: [{ label: "Flow", href: "https://acme.com/flow" }],
      },
      { label: "Guides", href: "https://acme.com/docs", icon: "book-open" },
      { type: "github", href: "https://github.com/acme" },
      { label: "Blog", href: "/blog" },
    ]);
    expect(navbar.areas).toEqual([{ area: "blog" }]);
    expect(navbar.cta).toEqual({
      label: "Sign up",
      href: "/signup",
      icon: "rocket",
    });
  });

  describe("navbar link positions", () => {
    const docs = { label: "Docs", href: "/docs", icon: "book-open" };
    const github = { type: "github", href: "https://github.com/acme" };
    const pricing = { label: "Pricing", href: "/pricing", icon: "coins" };
    const products = {
      label: "Products",
      items: [{ label: "Flow", href: "/flow" }],
    };
    const blog = { label: "Blog", href: "/blog" };
    const source: SiteRawConfig = {
      ...SOURCE,
      navbar: {
        ...(SOURCE.navbar as SiteRawConfig),
        links: [docs, github, pricing, products, blog],
      },
    };

    test.each([
      ["first", 0, [github, pricing, products, blog]],
      ["middle", 1, [docs, github, products, blog]],
    ] as const)(
      "deleting the %s plain link keeps surviving entries in order",
      (_, index, expected) => {
        const initial = readDesignForm(source);
        const form = {
          ...initial,
          navbarLinks: initial.navbarLinks.filter((_, i) => i !== index),
        };
        const config = patchDesign(source, form, initial);
        expect(siteConfigIssue(config)).toBeNull();
        expect((config.navbar as SiteRawConfig).links).toEqual(expected);
      }
    );

    test("clearing a plain link removes it without moving surviving entries", () => {
      const initial = readDesignForm(source);
      const form = {
        ...initial,
        navbarLinks: initial.navbarLinks.map((link, index) =>
          index === 1 ? { ...link, label: "  ", href: "" } : link
        ),
      };
      const config = patchDesign(source, form, initial);
      expect(siteConfigIssue(config)).toBeNull();
      expect((config.navbar as SiteRawConfig).links).toEqual([
        docs,
        github,
        products,
        blog,
      ]);
    });

    test("editing a retained link updates its original entry and keeps its icon", () => {
      const initial = readDesignForm(source);
      const form = {
        ...initial,
        navbarLinks: initial.navbarLinks
          .slice(1)
          .map((link) =>
            link.label === "Pricing"
              ? { ...link, label: " Plans ", href: " /plans " }
              : link
          ),
      };
      const config = patchDesign(source, form, initial);
      expect(siteConfigIssue(config)).toBeNull();
      expect((config.navbar as SiteRawConfig).links).toEqual([
        github,
        { ...pricing, label: "Plans", href: "/plans" },
        products,
        blog,
      ]);
    });

    test("new links append after existing entries instead of filling deleted slots", () => {
      const initial = readDesignForm(source);
      const form = {
        ...initial,
        navbarLinks: [
          ...initial.navbarLinks.slice(1),
          { id: "new", label: " Contact ", href: " /contact " },
        ],
      };
      const config = patchDesign(source, form, initial);
      expect(siteConfigIssue(config)).toBeNull();
      expect((config.navbar as SiteRawConfig).links).toEqual([
        github,
        pricing,
        products,
        blog,
        { label: "Contact", href: "/contact" },
      ]);
    });
  });

  test.each(["links", "primary", "remove primary"])(
    "editing navbar %s preserves the existing CTA",
    (edit) => {
      const originalNavbar = SOURCE.navbar as SiteRawConfig;
      const navbar = {
        ...originalNavbar,
        primary: { type: "github", href: "https://github.com/acme" },
      };
      const source = { ...SOURCE, navbar };
      const initial = readDesignForm(source);
      const form: SiteDesignForm = {
        ...initial,
        ...(edit === "links"
          ? {
              navbarLinks: initial.navbarLinks.map((link) => ({
                ...link,
                label: `${link.label} updated`,
              })),
            }
          : edit === "primary"
            ? { navbarButtonHref: "https://github.com/acme/blog" }
            : { navbarButton: "none" }),
      };
      const config = patchDesign(source, form, initial);
      expect(siteConfigIssue(config)).toBeNull();
      const patched = config.navbar as SiteRawConfig;
      expect(patched.cta).toEqual(originalNavbar.cta);
      expect(patched.primary).toEqual(
        edit === "remove primary"
          ? undefined
          : {
              ...navbar.primary,
              href:
                edit === "primary"
                  ? "https://github.com/acme/blog"
                  : navbar.primary.href,
            }
      );
      if (edit !== "links") {
        expect(patched.links).toEqual(originalNavbar.links);
      }
    }
  );

  test("an untouched form writes the source back unchanged", () => {
    const initial = readDesignForm(SOURCE);
    expect(patchDesign(SOURCE, initial, initial)).toEqual(SOURCE);
  });

  test("schema problems surface as path and message", () => {
    const { config } = variant({ name: "", navbarButton: "github" });
    expect(siteConfigIssue(config)).toBe("name");
  });
});

function guidelines(
  partial: Partial<BrandGuidelinesResponse>
): BrandGuidelinesResponse {
  return {
    guideline: null,
    assets: [],
    colors: [],
    fonts: [],
    screenshots: [],
    tokens: [],
    ...partial,
  };
}

const asset = (variant: "light" | "dark", url: string) =>
  ({ kind: "logo", variant, url }) as BrandGuidelinesResponse["assets"][number];
const color = (role: string, lightValue: string) =>
  ({ role, lightValue }) as BrandGuidelinesResponse["colors"][number];
const font = (role: string, family: string) =>
  ({ role, family }) as BrandGuidelinesResponse["fonts"][number];

describe("brand identity defaults", () => {
  test("reads primary color, logos and fonts", () => {
    expect(
      brandDefaultsFromGuidelines(
        guidelines({
          colors: [color("primary", "#ff0066")],
          assets: [
            asset("light", "https://cdn/l.svg"),
            asset("dark", "https://cdn/d.svg"),
          ],
          fonts: [font("heading", "Fraunces"), font("body", "Inter")],
        })
      )
    ).toEqual({
      primary: "#FF0066",
      logoLight: "https://cdn/l.svg",
      logoDark: "https://cdn/d.svg",
      headingFamily: "Fraunces",
      bodyFamily: "Inter",
    });
  });

  test("ignores non-hex colors, falls back to the dark logo, and is null when empty", () => {
    expect(
      brandDefaultsFromGuidelines(
        guidelines({
          colors: [color("primary", "oklch(0.6 0.2 30)")],
          assets: [asset("dark", "https://cdn/d.svg")],
        })
      )
    ).toEqual({
      primary: undefined,
      logoLight: "https://cdn/d.svg",
      logoDark: "https://cdn/d.svg",
      headingFamily: undefined,
      bodyFamily: undefined,
    });
    expect(brandDefaultsFromGuidelines(guidelines({}))).toBeNull();
  });

  test("applying the brand switches to a font pair and keeps weights", () => {
    const form: SiteDesignForm = {
      ...readDesignForm(SOURCE),
      font: { ...EMPTY_FONT, family: "Geist", weight: "500" },
    };
    const brand = {
      primary: "#FF0066",
      logoLight: "https://cdn/l.svg",
      logoDark: "https://cdn/d.svg",
      headingFamily: "Fraunces",
    };
    const next = applyBrandToDesign(brand, form);
    expect(next).toMatchObject({
      primary: "#FF0066",
      separateLogos: true,
      logoLight: "https://cdn/l.svg",
      logoDark: "https://cdn/d.svg",
      typographyMode: "pair",
      heading: { ...EMPTY_FONT, family: "Fraunces" },
      body: { ...EMPTY_FONT, family: "Geist", weight: "500" },
    });
    const config = patchDesign(SOURCE, next, form);
    expect(siteConfigIssue(config)).toBeNull();
    expect(readDesignForm(config)).toEqual(written(next));

    expect(describeBrandForDesign(brand, form)).toEqual([
      { field: "primary", kind: "color", from: "#112233", to: "#FF0066" },
      {
        field: "logoLight",
        kind: "image",
        from: "/logo.svg",
        to: "https://cdn/l.svg",
      },
      { field: "logoDark", kind: "image", from: "", to: "https://cdn/d.svg" },
      { field: "heading", kind: "font", from: "", to: "Fraunces" },
    ]);
  });

  test("a brand matching the form describes no changes", () => {
    const form = readDesignForm(SOURCE);
    expect(
      describeBrandForDesign(
        { primary: "#112233", logoLight: "/logo.svg" },
        form
      )
    ).toEqual([]);
  });
});
