import { SITE_ENTRY_SLUG } from "@notra/sites-core/constants/entries";
import {
  SITE_CHROME_FILES,
  SITE_SLOT_NAMES,
  SITE_SLOTS_DIR,
} from "@notra/sites-core/constants/site-layout";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import {
  SITE_IGNORE_FILENAME,
  SITE_IGNORE_MAX_BYTES,
} from "@notra/sites-core/constants/source";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import {
  siteBlogSchema,
  siteChangelogSchema,
  siteMarkdownSchema,
} from "@notra/sites-core/schemas/site-layout";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import { isCustomScriptPath } from "@notra/sites-core/utils/custom-scripts";
import { parseSiteEntryFile } from "@notra/sites-core/utils/entries";
import { filterSiteFiles } from "@notra/sites-core/utils/site-ignore";
import { tagSlug } from "@notra/sites-core/utils/tags";
import { Parser } from "acorn";
import { fromMarkdown } from "mdast-util-from-markdown";

import { URL_SCHEME } from "./constants/links";
import { MDX_FILE, SCRIPT_FILE } from "./constants/validate";
import { frontmatterKeyLine, parseEntryFrontmatter } from "./frontmatter";
import { analyzeJsxSnippet } from "./jsx";
import { analyzeMdxFile } from "./mdx";
import type { SiteEntry } from "./types/entries";
import type { ContentLink, LinkPage, SiteContentLink } from "./types/links";
import type { MdxAnalysis } from "./types/mdx";
import type {
  ParsedSiteConfig,
  SiteValidationInput,
  SiteValidationResult,
  SubstitutedSettings,
  SubstitutedSources,
} from "./types/validate";
import {
  authorLinkSchemeWarnings,
  categoryWarnings,
  featuredSlugWarnings,
  redirectPatternWarnings,
  navbarPrimaryButtonWarnings,
  unknownConfigKeyWarnings,
  unknownIconWarnings,
} from "./utils/config-checks";
import { contentLinks } from "./utils/content-links";
import { collapseRepeatedWarnings, hasErrors } from "./utils/diagnostics";
import { acornSyntaxError, errorMessage } from "./utils/errors";
import { importCycleDiagnostics } from "./utils/import-cycles";
import { sharedFilePages } from "./utils/link-pages";
import { blockedMarkdownHtml } from "./utils/markdown-html";
import { isTextSourceFile, offsetToLineColumn } from "./utils/paths";
import { substituteSettingText, substituteVariables } from "./utils/variables";

function takesVariables(path: string): boolean {
  return (
    parseSiteEntryFile(path) !== null ||
    (SITE_CHROME_FILES as readonly string[]).includes(path) ||
    (path.startsWith("snippets/") && MDX_FILE.test(path)) ||
    (path.startsWith(`${SITE_SLOTS_DIR}/`) && MDX_FILE.test(path))
  );
}

function validateSlotFile(path: string): SiteDiagnostic[] {
  if (!path.startsWith(`${SITE_SLOTS_DIR}/`)) {
    return [];
  }
  const name = path.slice(SITE_SLOTS_DIR.length + 1);
  const slotName = name.replace(/\.mdx$/, "");
  if (
    name.endsWith(".mdx") &&
    (SITE_SLOT_NAMES as readonly string[]).includes(slotName)
  ) {
    return [];
  }
  return [
    {
      severity: "error",
      file: path,
      code: "slot_unknown",
      message: `Unknown slot "${name}". Files in ${SITE_SLOTS_DIR}/ must be one of: ${SITE_SLOT_NAMES.map((slot) => `${slot}.mdx`).join(", ")}`,
    },
  ];
}

type Instructions = SiteConfig["markdown"]["instructions"];

function substituteInstructions(
  instructions: Instructions,
  fill: (text: string, setting: string) => string | undefined,
  diagnostics: SiteDiagnostic[]
): Instructions {
  if (instructions === undefined) {
    return undefined;
  }
  const filled =
    typeof instructions === "string"
      ? (fill(instructions, "markdown.instructions") ?? instructions)
      : instructions.map(
          (line, index) => fill(line, `markdown.instructions[${index}]`) ?? line
        );
  if (siteMarkdownSchema.safeParse({ instructions: filled }).success) {
    return filled;
  }
  diagnostics.push(
    configError(
      "instructions_too_long",
      "markdown.instructions is over its length limit once variables are filled in. Shorten the text or the variables it uses."
    )
  );
  return instructions;
}

function substituteSettingVariables(config: SiteConfig): SubstitutedSettings {
  const diagnostics: SiteDiagnostic[] = [];
  const fill = (text: string | undefined, setting: string) => {
    if (text === undefined || !text.includes("{{")) {
      return text;
    }
    const result = substituteSettingText(text, config.variables);
    for (const name of result.unknown) {
      diagnostics.push({
        severity: "warning",
        file: SITE_CONFIG_FILENAME,
        code: "variable_unknown",
        message: `${setting}: unknown variable {{ ${name} }}. Add "${name}" to variables. It is shown as written.`,
      });
    }
    return result.text;
  };
  const instructions = substituteInstructions(
    config.markdown.instructions,
    fill,
    diagnostics
  );
  return {
    config: {
      ...config,
      description: fill(config.description, "description"),
      markdown: { ...config.markdown, instructions },
      banner: config.banner
        ? {
            ...config.banner,
            content:
              fill(config.banner.content, "banner.content") ??
              config.banner.content,
          }
        : undefined,
      blog: config.blog
        ? {
            ...config.blog,
            title: fill(config.blog.title, "blog.title"),
            description: fill(config.blog.description, "blog.description"),
          }
        : undefined,
      changelog: config.changelog
        ? {
            ...config.changelog,
            title: fill(config.changelog.title, "changelog.title"),
            description: fill(
              config.changelog.description,
              "changelog.description"
            ),
          }
        : undefined,
    },
    diagnostics,
  };
}

function configError(code: string, message: string): SiteDiagnostic {
  return { severity: "error", file: SITE_CONFIG_FILENAME, code, message };
}

function parseSiteConfig(raw: string | null | undefined): ParsedSiteConfig {
  if (raw === undefined || raw === null) {
    return {
      config: null,
      diagnostics: [
        configError(
          "config_missing",
          `Add a ${SITE_CONFIG_FILENAME} at the site root, e.g. { "name": "Acme" }`
        ),
      ],
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return {
      config: null,
      diagnostics: [
        configError(
          "config_json",
          `${SITE_CONFIG_FILENAME} is not valid JSON: ${errorMessage(error)}`
        ),
      ],
    };
  }
  const diagnostics = [
    ...unknownConfigKeyWarnings(json),
    ...navbarPrimaryButtonWarnings(json),
  ];
  const parsed = siteConfigSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push(
        configError(
          "config_invalid",
          `${issue.path.join(".") || "config"}: ${issue.message}`
        )
      );
    }
    return { config: null, diagnostics };
  }
  diagnostics.push(...unknownIconWarnings(parsed.data, raw));
  diagnostics.push(...redirectPatternWarnings(parsed.data));
  diagnostics.push(...authorLinkSchemeWarnings(parsed.data));
  const settings = substituteSettingVariables(parsed.data);
  diagnostics.push(...settings.diagnostics);
  return {
    config: {
      ...settings.config,
      blog: settings.config.blog ?? siteBlogSchema.parse({}),
      changelog: settings.config.changelog ?? siteChangelogSchema.parse({}),
    },
    diagnostics,
  };
}

function applyVariables(
  files: ReadonlyMap<string, string | null>,
  variables: Readonly<Record<string, string>>
): SubstitutedSources {
  const sources = new Map(files);
  const diagnostics: SiteDiagnostic[] = [];
  for (const [path, content] of files) {
    if (content === null || !takesVariables(path) || !content.includes("{{")) {
      continue;
    }
    const substitution = substituteVariables(
      content,
      variables,
      MDX_FILE.test(path)
    );
    sources.set(path, substitution.text);
    for (const unknown of substitution.unknown) {
      diagnostics.push({
        severity: "warning",
        file: path,
        ...offsetToLineColumn(content, unknown.offset),
        code: "variable_unknown",
        message: `Unknown variable {{ ${unknown.name} }}. Add "${unknown.name}" to variables in ${SITE_CONFIG_FILENAME}. It is shown as written.`,
      });
    }
  }
  return { sources, diagnostics };
}

function validateCustomScript(path: string, source: string): SiteDiagnostic[] {
  try {
    Parser.parse(source, { ecmaVersion: "latest", sourceType: "script" });
    return [];
  } catch (error) {
    const syntax = acornSyntaxError(error);
    return [
      {
        severity: "error",
        file: path,
        ...offsetToLineColumn(source, syntax.offset),
        code: "script_syntax",
        message: `Syntax error: ${syntax.message}. Custom scripts are plain browser JavaScript, not modules.`,
      },
    ];
  }
}

export function validateSite(input: SiteValidationInput): SiteValidationResult {
  const ignoreContent = input.files.get(SITE_IGNORE_FILENAME);
  if (
    ignoreContent === null ||
    (ignoreContent !== undefined &&
      new TextEncoder().encode(ignoreContent).length > SITE_IGNORE_MAX_BYTES)
  ) {
    return {
      ok: false,
      config: null,
      entries: [],
      links: [],
      outputs: new Map(),
      diagnostics: [
        {
          severity: "error",
          file: SITE_IGNORE_FILENAME,
          code: "ignore_file_invalid",
          message: `${SITE_IGNORE_FILENAME} must be readable and at most ${SITE_IGNORE_MAX_BYTES / 1024} KB`,
        },
      ],
    };
  }
  const files = filterSiteFiles(input.files);
  const outputs = new Map<string, string>();
  const paths = new Set(
    [...files.keys()].filter((path) => !isCustomScriptPath(path))
  );

  const usesDefaultConfig =
    !files.has(SITE_CONFIG_FILENAME) && input.defaultConfig !== undefined;
  const { config, diagnostics } = parseSiteConfig(
    usesDefaultConfig
      ? JSON.stringify(input.defaultConfig)
      : files.get(SITE_CONFIG_FILENAME)
  );
  if (usesDefaultConfig && config) {
    outputs.set(SITE_CONFIG_FILENAME, JSON.stringify(config));
  }

  const { sources, diagnostics: variableDiagnostics } = config
    ? applyVariables(files, config.variables)
    : { sources: new Map(files), diagnostics: [] };
  diagnostics.push(...variableDiagnostics);
  for (const path of files.keys()) {
    diagnostics.push(...validateSlotFile(path));
  }

  const componentExports = new Map<string, readonly string[]>();
  for (const [path, content] of files) {
    if (!SCRIPT_FILE.test(path) || content === null) {
      continue;
    }
    if (isCustomScriptPath(path)) {
      diagnostics.push(...validateCustomScript(path, content));
      continue;
    }
    const analysis = analyzeJsxSnippet(path, content);
    diagnostics.push(...analysis.diagnostics);
    componentExports.set(path, analysis.exportedNames);
    if (analysis.output !== null) {
      outputs.set(path, analysis.output);
    }
  }

  const mdxPaths = [...files.keys()].filter((path) => MDX_FILE.test(path));
  const analyses = new Map<string, MdxAnalysis>();
  const analyze = (path: string, isEntry: boolean) => {
    analyses.set(
      path,
      analyzeMdxFile(path, sources.get(path) ?? "", {
        files: paths,
        componentExports,
        isEntry,
      })
    );
  };
  for (const path of mdxPaths) {
    analyze(path, parseSiteEntryFile(path) !== null);
  }

  const importedPaths = new Set(
    [...analyses.values()].flatMap((analysis) => analysis.imports)
  );
  for (const path of mdxPaths) {
    if (importedPaths.has(path) && parseSiteEntryFile(path) !== null) {
      analyze(path, false);
    }
  }

  diagnostics.push(
    ...importCycleDiagnostics(
      mdxPaths,
      (path) => analyses.get(path)?.imports ?? []
    )
  );

  for (const [path, analysis] of analyses) {
    diagnostics.push(...analysis.diagnostics);
    if (analysis.output !== null) {
      outputs.set(path, analysis.output);
    }
    if (analysis.inlineModule) {
      outputs.set(analysis.inlineModule.path, analysis.inlineModule.source);
    }
  }

  const entries: SiteEntry[] = [];
  const links: SiteContentLink[] = [];
  const entryPages = new Map<string, LinkPage>();
  const seenSlugs = new Map<string, string>();
  let unreadEntries = 0;
  const blogTags = new Set<string>();
  for (const [path, content] of files) {
    const candidate = parseSiteEntryFile(path);
    if (!candidate || importedPaths.has(path)) {
      continue;
    }
    if (content === null) {
      unreadEntries += 1;
      continue;
    }
    if (!SITE_ENTRY_SLUG.test(candidate.slug)) {
      diagnostics.push({
        severity: "error",
        file: path,
        code: "slug_invalid",
        message: `The URL "${candidate.slug}" comes from the file name. Use lowercase letters, digits and dashes.`,
      });
      continue;
    }
    const key = `${candidate.area}:${candidate.slug}`;
    const existing = seenSlugs.get(key);
    if (existing) {
      diagnostics.push({
        severity: "error",
        file: path,
        code: "slug_duplicate",
        message: `Same URL as ${existing}`,
      });
      continue;
    }
    seenSlugs.set(key, path);
    const substituted = sources.get(path) ?? content;
    const frontmatter = parseEntryFrontmatter(
      path,
      candidate.area,
      substituted
    );
    diagnostics.push(...frontmatter.diagnostics);
    if (candidate.area === "blog") {
      for (const tag of frontmatter.data?.tags ?? []) {
        const slug = tagSlug(tag);
        if (slug) {
          blogTags.add(slug);
        }
      }
    }
    let bodyLinks: ContentLink[] = analyses.get(path)?.links ?? [];
    if (candidate.format === "md") {
      const tree = fromMarkdown(substituted);
      diagnostics.push(...blockedMarkdownHtml(path, substituted, tree));
      bodyLinks = contentLinks(tree);
      if (substituted !== content) {
        outputs.set(path, substituted);
      }
    }
    const page: LinkPage = {
      area: candidate.area,
      slug: candidate.slug,
      draft: frontmatter.data?.draft ?? true,
    };
    entryPages.set(path, page);
    const linkOf = { file: path, pages: [page], shared: false };
    for (const link of bodyLinks) {
      links.push({
        ...linkOf,
        url: link.url,
        kind: link.kind,
        ...offsetToLineColumn(substituted, link.offset),
      });
    }
    const image = frontmatter.data?.image;
    if (image) {
      links.push({
        ...linkOf,
        // The theme reads a cover path as relative to the site root.
        url:
          URL_SCHEME.test(image) || image.startsWith("/") ? image : `/${image}`,
        kind: "image",
        line: frontmatterKeyLine(substituted, "image"),
      });
    }
    entries.push({
      area: candidate.area,
      slug: candidate.slug,
      path,
      format: candidate.format,
    });
  }
  for (const [path, pages] of sharedFilePages(
    files.keys(),
    entryPages,
    (path) => analyses.get(path)?.imports ?? []
  )) {
    const source = sources.get(path) ?? "";
    const fileLinks =
      analyses.get(path)?.links ??
      (path.endsWith(".md") ? contentLinks(fromMarkdown(source)) : []);
    for (const link of fileLinks) {
      links.push({
        file: path,
        pages,
        shared: true,
        url: link.url,
        kind: link.kind,
        ...offsetToLineColumn(source, link.offset),
      });
    }
  }

  if (config) {
    if (entries.length === 0 && unreadEntries === 0) {
      diagnostics.push({
        severity: "warning",
        file: null,
        code: "no_entries",
        message: "No posts yet. Add .mdx files to blog/ or changelog/.",
      });
    }
    diagnostics.push(...featuredSlugWarnings(config, entries));
    diagnostics.push(...categoryWarnings(config, blogTags));
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return {
    diagnostics: collapseRepeatedWarnings(diagnostics),
    config,
    entries,
    links,
    outputs,
    ok: !hasErrors(diagnostics),
  };
}
