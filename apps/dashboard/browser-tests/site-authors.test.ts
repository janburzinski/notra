import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import {
  type Browser,
  chromium,
  expect as browserExpect,
  type Page,
} from "playwright/test";
import { build } from "vite";

import {
  SITE_AUTHORS_AVATAR_PNG,
  SITE_AUTHORS_AVATAR_SVG,
  SITE_AUTHORS_HTML,
} from "./constants/site-authors";

const TIMEOUT = 30_000;
let browser: Browser;
let server: ReturnType<typeof createServer>;
let baseUrl: string;

beforeAll(async () => {
  const script = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("utils/build-site-workspace.mjs", import.meta.url)),
      fileURLToPath(new URL("fixtures/site-authors.tsx", import.meta.url)),
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  let css = "";
  await build({
    root: fileURLToPath(new URL("..", import.meta.url)),
    configFile: false,
    logLevel: "silent",
    plugins: [
      tailwindcss(),
      {
        name: "authors-fixture-css",
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
      rolldownOptions: {
        input: fileURLToPath(
          new URL("../src/styles/globals.css", import.meta.url)
        ),
      },
    },
  });
  server = createServer((request, response) => {
    const path = request.url ?? "/";
    if (path === "/fixture.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(script);
    } else if (path === "/fixture.css") {
      response.setHeader("content-type", "text/css");
      response.end(css);
    } else if (path.startsWith("/api/uploads/")) {
      response.setHeader("content-type", "image/svg+xml");
      response.end(SITE_AUTHORS_AVATAR_SVG);
    } else {
      response.setHeader("content-type", "text/html");
      response.end(SITE_AUTHORS_HTML);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Authors fixture server has no address");
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

async function open(search = "") {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  // The site's avatars live on its (synthetic) domain; serve them locally.
  await page.route("https://acme.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: SITE_AUTHORS_AVATAR_SVG,
    })
  );
  await page.goto(`${baseUrl}/${search}`);
  return page;
}

async function persisted(page: Page) {
  await page
    .getByRole("button", { name: "Flush", includeHidden: true })
    .dispatchEvent("click");
  await browserExpect(page.getByTestId("status")).toHaveText(/^(idle|saved)$/);
  return JSON.parse(
    (await page.getByTestId("persisted").textContent()) ?? "{}"
  );
}

test(
  "adding an author in Design validates the form and stages it in blog.json",
  async () => {
    const page = await open();
    await browserExpect(
      page.getByText("Jan Burzinski", { exact: true })
    ).toBeVisible();
    await browserExpect(
      page.getByRole("link", { name: "View Jan Burzinski's author page" })
    ).toHaveAttribute("href", "https://acme.example.test/blog/author/jan");
    await page.getByRole("button", { name: "Add author", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Name" }).fill("Maya Chen");
    const id = dialog.getByRole("textbox", { name: "ID", exact: true });
    await browserExpect(id).toHaveValue("maya-chen");
    await dialog.getByRole("textbox", { name: "Role" }).fill("Staff writer");
    await dialog
      .getByRole("textbox", { name: "Bio" })
      .fill("Writes the changelog.");
    await dialog
      .getByRole("textbox", { name: "Bluesky" })
      .fill("http://bsky.app/profile/maya");
    await id.fill("jan");
    await dialog.getByRole("button", { name: "Add author" }).click();
    await browserExpect(id).toHaveAttribute("aria-invalid", "true");
    await browserExpect(
      dialog.getByText("Another author already uses this ID.")
    ).toBeVisible();
    await browserExpect(
      dialog.getByText("Use a full https:// link.")
    ).toBeVisible();
    await id.fill("maya");
    await dialog
      .getByRole("textbox", { name: "Bluesky" })
      .fill("https://bsky.app/profile/maya");
    await dialog.getByRole("button", { name: "Add author" }).click();
    await browserExpect(dialog).toHaveCount(0);
    await browserExpect(
      page.getByText("Maya Chen", { exact: true })
    ).toBeVisible();
    await browserExpect(page.getByText("Unpublished changes")).toBeVisible();
    expect((await persisted(page)).authors).toEqual({
      jan: expect.objectContaining({ name: "Jan Burzinski" }),
      lena: expect.objectContaining({ name: "Lena Park" }),
      maya: {
        name: "Maya Chen",
        title: "Staff writer",
        bio: "Writes the changelog.",
        bluesky: "https://bsky.app/profile/maya",
      },
    });
  },
  TIMEOUT
);

test(
  "an avatar can be uploaded right from the author form",
  async () => {
    const page = await open();
    await page.getByRole("button", { name: "Add author", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Name" }).fill("Sam Rivera");
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      dialog.getByRole("button", { name: "Upload image" }).click(),
    ]);
    await chooser.setFiles({
      name: "sam.png",
      mimeType: "image/png",
      buffer: Buffer.from(SITE_AUTHORS_AVATAR_PNG, "base64"),
    });
    const path = dialog.getByRole("textbox", { name: "Avatar path or URL" });
    await browserExpect(path).toHaveValue("/images/sam-rivera-0123456789.png");
    await browserExpect(
      dialog.getByRole("button", { name: "Replace image" })
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Add author" }).click();
    await browserExpect(dialog).toHaveCount(0);
    expect((await persisted(page)).authors["sam-rivera"]).toEqual({
      name: "Sam Rivera",
      avatar: "/images/sam-rivera-0123456789.png",
    });
  },
  TIMEOUT
);

test(
  "an id posts use only changes after an explicit unlock that warns, keeping its place",
  async () => {
    const page = await open();
    await page.getByRole("button", { name: "Edit Jan Burzinski" }).click();
    const dialog = page.getByRole("dialog");
    const id = dialog.getByRole("textbox", { name: "ID", exact: true });
    await browserExpect(id).toHaveAttribute("readonly", "");
    await dialog.getByRole("button", { name: "Change ID" }).click();
    await browserExpect(
      dialog.getByText(/Changing it moves the author page/)
    ).toBeVisible();
    await browserExpect(dialog.getByText(/2 posts use “jan”/)).toBeVisible();
    await id.fill("jan-b");
    await dialog.getByRole("button", { name: "Save author" }).click();
    const authors = (await persisted(page)).authors;
    expect(Object.keys(authors)).toEqual(["jan-b", "lena"]);
    expect(authors["jan-b"]).toMatchObject({
      name: "Jan Burzinski",
      title: "Engineer",
    });
  },
  TIMEOUT
);

test(
  "deleting an author posts reference warns with the post count",
  async () => {
    const page = await open();
    await page.getByRole("button", { name: "Delete Jan Burzinski" }).click();
    const confirm = page.getByRole("alertdialog");
    await browserExpect(confirm).toContainText(
      "2 Notra posts name this author"
    );
    await confirm.getByRole("button", { name: "Delete author" }).click();
    expect(Object.keys((await persisted(page)).authors)).toEqual(["lena"]);
  },
  TIMEOUT
);

test(
  "the author page layout switches blog.authorPage",
  async () => {
    const page = await open();
    const stacked = page.getByRole("radio", { name: "Stacked" });
    const inline = page.getByRole("radio", { name: "Inline" });
    await browserExpect(inline).toHaveAttribute("aria-checked", "true");
    await stacked.click();
    await browserExpect(stacked).toHaveAttribute("aria-checked", "true");
    expect((await persisted(page)).blog).toEqual({ authorPage: "stacked" });
    await inline.click();
    expect((await persisted(page)).blog).toBeUndefined();
  },
  TIMEOUT
);

test(
  "Notra authors import into blog.json for review, copying dashboard-only avatars",
  async () => {
    const page = await open();
    await page.getByRole("button", { name: "Review import" }).click();
    const dialog = page.getByRole("dialog");
    await browserExpect(
      dialog.getByRole("checkbox", { name: /Jan Burzinski/ })
    ).toBeDisabled();
    await browserExpect(
      dialog.getByText("Already in blog.json as jan")
    ).toBeVisible();
    await dialog.getByRole("checkbox", { name: /Priya Natarajan/ }).click();
    await dialog.getByRole("button", { name: "Import 1 author" }).click();
    await browserExpect(dialog).toHaveCount(0);
    await browserExpect(
      page.getByText("Sam Rivera", { exact: true })
    ).toBeVisible();
    const authors = (await persisted(page)).authors;
    expect(Object.keys(authors)).toEqual(["jan", "lena", "sam-rivera"]);
    expect(authors["sam-rivera"]).toEqual({
      name: "Sam Rivera",
      title: "Developer advocate",
      avatar: "/images/sam-rivera-0123456789.png",
      url: "https://example.com",
    });
  },
  TIMEOUT
);

test(
  "the post editor offers the site's authors and publishing writes author: <id>",
  async () => {
    const page = await open("?editor");
    await browserExpect(
      page.getByRole("link", { name: "Manage" })
    ).toHaveAttribute("href", "/acme/sites/site-a/design?section=authors");
    await browserExpect(
      page.getByRole("link", { name: "New author" })
    ).toHaveAttribute(
      "href",
      "/acme/sites/site-a/design?section=authors&author=new"
    );
    await page.getByRole("combobox", { name: "Authors" }).click();
    await page.getByRole("option", { name: /Lena Park/ }).click();
    await page.keyboard.press("Escape");
    await browserExpect(page.getByTestId("saves")).toContainText("site:lena", {
      timeout: 5000,
    });
    expect(
      JSON.parse((await page.getByTestId("saves").textContent()) ?? "[]")
    ).toEqual([{ authorIds: ["site:lena"] }]);
    await browserExpect(page.getByTestId("frontmatter")).toContainText(
      "\nauthor: lena\n"
    );
  },
  TIMEOUT
);

test(
  "a legacy Notra author whose slug is in blog.json shows as that site author",
  async () => {
    const page = await open("?editor&legacy");
    const picker = page.getByRole("combobox", { name: "Authors" });
    await browserExpect(picker).toContainText("Jan Burzinski");
    await picker.click();
    await page.getByRole("option", { name: /Lena Park/ }).click();
    await page.keyboard.press("Escape");
    await browserExpect(page.getByTestId("saves")).toContainText("site:lena");
    expect(
      JSON.parse((await page.getByTestId("saves").textContent()) ?? "[]")
    ).toEqual([{ authorIds: ["site:jan", "site:lena"] }]);
    await browserExpect(page.getByTestId("frontmatter")).toContainText(
      "author:\n  - jan\n  - lena\n"
    );
  },
  TIMEOUT
);
