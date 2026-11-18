import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import {
  type Browser,
  chromium,
  expect as browserExpect,
} from "playwright/test";
import { build } from "vite";

import { MENU_HIGHLIGHT_HTML } from "./constants/menu-highlight";

let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;

beforeAll(async () => {
  let script = "";
  await build({
    configFile: false,
    logLevel: "silent",
    oxc: { jsx: { runtime: "automatic", development: false } },
    resolve: {
      alias: [
        {
          find: /^@\/components\/ui\//,
          replacement: fileURLToPath(
            new URL("../../../packages/ui/src/components/ui/", import.meta.url)
          ),
        },
      ],
    },
    plugins: [
      {
        name: "menu-highlight-fixture-js",
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (output.type === "chunk") {
              script += output.code;
            }
          }
        },
      },
    ],
    build: {
      write: false,
      lib: {
        entry: fileURLToPath(
          new URL("fixtures/menu-highlight.tsx", import.meta.url)
        ),
        formats: ["iife"],
        name: "MenuHighlightFixture",
      },
      rolldownOptions: { checks: { moduleLevelDirective: false } },
    },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
  });
  expect(script.length).toBeGreaterThan(0);
  const stylesheets = new Map<string, string>();
  for (const theme of ["dashboard", "web"]) {
    let css = "";
    const root = fileURLToPath(new URL(`../../${theme}/`, import.meta.url));
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [
        tailwindcss(),
        {
          name: "menu-highlight-fixture-css",
          generateBundle(_options, bundle) {
            for (const asset of Object.values(bundle)) {
              if (asset.type === "asset" && asset.fileName.endsWith(".css")) {
                css += asset.source;
              }
            }
          },
        },
      ],
      build: {
        write: false,
        rolldownOptions: { input: join(root, "src/styles/globals.css") },
      },
    });
    expect(css.length).toBeGreaterThan(0);
    stylesheets.set(`/${theme}.css`, css);
  }
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/fixture.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(script);
      return;
    }
    const stylesheet = stylesheets.get(url.pathname);
    if (stylesheet) {
      response.setHeader("content-type", "text/css");
      response.end(stylesheet);
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end(
      MENU_HIGHLIGHT_HTML.replace(
        "__THEME_CLASS__",
        url.searchParams.has("dark") ? "dark" : ""
      ).replace("__STYLESHEET__", `${url.pathname}.css`)
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Browser fixture server has no address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
}, 60_000);

afterEach(async () => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

afterAll(async () => {
  await browser?.close();
  server?.close();
});

describe("table row context menus", () => {
  test("mouse selection acts on the correct row without opening it", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/dashboard`);
    await page.getByText("First", { exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Action for First" }).click();
    await browserExpect(page.getByTestId("row-result")).toHaveText(
      "Action for First"
    );
  });

  test("keyboard opens menus on clickable and menu-only rows", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/dashboard`);
    const first = page.getByRole("row").filter({ hasText: "First" });
    await first.focus();
    await first.press("Shift+F10");
    await browserExpect(
      page.getByRole("menuitem", { name: "Action for First" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await browserExpect(page.getByRole("menu")).toBeHidden();
    await browserExpect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await browserExpect(page.getByTestId("row-result")).toHaveText(
      "Opened First"
    );
    const menuOnly = page.getByRole("row").filter({ hasText: "Menu only" });
    await menuOnly.press("ContextMenu");
    await browserExpect(
      page.getByRole("menuitem", { name: "Action for Menu only" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await browserExpect(menuOnly).toBeFocused();
  });

  test("links and selection remain independent and null menus keep native right-click", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/dashboard`);
    const first = page.getByRole("row").filter({ hasText: "First" });
    await first.getByRole("link", { name: "Row link" }).click();
    await browserExpect(page).toHaveURL(/#first$/);
    await first.getByRole("checkbox").click();
    await browserExpect(page.getByTestId("row-selection")).toHaveText("First");
    await browserExpect(page.getByTestId("row-result")).toBeEmpty();
    await first.press("Space");
    await browserExpect(page.getByTestId("row-result")).toHaveText(
      "Opened First"
    );
    const native = page.getByText("Native", { exact: true });
    expect(
      await native.evaluate((element) =>
        element.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
        )
      )
    ).toBe(true);
    await browserExpect(page.getByRole("menu")).toBeHidden();
  });
});

describe.each(["dashboard", "web"])("%s menu highlights", (theme) => {
  test.each([false, true])("dropdown highlight, dark=%s", async (dark) => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/${theme}${dark ? "?dark" : ""}`);
    await page.getByRole("button", { name: "Open menu" }).click();
    const item = page.getByRole("menuitem", { name: "Prompts", exact: true });
    await item.hover();
    await browserExpect(item).toHaveCSS(
      "background-color",
      dark ? /\/ 0\.07\)/ : /\/ 0\.05\)/
    );
    if (dark) {
      await browserExpect(item).toHaveCSS("box-shadow", /inset/);
    }
  });

  test.each([
    ["context", false],
    ["context", true],
    ["dropdown", false],
    ["dropdown", true],
  ] as const)(
    "open %s submenu stays highlighted, dark=%s",
    async (menu, dark) => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/${theme}${dark ? "?dark" : ""}`);
      if (menu === "context") {
        await page.getByTestId("context-trigger").click({ button: "right" });
      } else {
        await page.getByRole("button", { name: "Open menu" }).click();
      }
      const trigger = page.getByRole("menuitem", {
        name: menu === "context" ? "More" : "Share",
        exact: true,
      });
      await trigger.hover();
      const child = page.getByRole("menuitem", {
        name: menu === "context" ? "Child action" : "Copy link",
        exact: true,
      });
      await child.hover();
      await browserExpect(trigger).toHaveAttribute("data-popup-open", "");
      await browserExpect(child).toBeFocused();
      await browserExpect(trigger).not.toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)"
      );
      if (dark) {
        await browserExpect(trigger).toHaveCSS(
          "background-color",
          /\/ 0\.07\)/
        );
        await browserExpect(trigger).toHaveCSS("box-shadow", /inset/);
      }
    }
  );
});
