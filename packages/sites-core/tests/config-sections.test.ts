import { expect, test } from "bun:test";

import { siteConfigSchema } from "../src/schemas/site-config";
import { readConfigSections } from "../src/utils/config-sections";

test.each([
  [null, null],
  ["", null],
  ["{ not json", null],
  [JSON.stringify({ name: "Acme" }), null],
  [JSON.stringify({ name: "Acme", sections: {} }), null],
  [JSON.stringify({ sections: { blog: "/blog", changelog: "/blog" } }), null],
  [JSON.stringify({ sections: { blog: "/blog", changelog: "/blog/x" } }), null],
  [JSON.stringify({ sections: { blog: "blog" } }), null],
  [JSON.stringify({ sections: { blog: "/blog", docs: "/docs" } }), null],
  [
    JSON.stringify({ sections: { blog: "/Blog/", changelog: "/changelog" } }),
    { blog: "/blog", changelog: "/changelog" },
  ],
  [JSON.stringify({ sections: { blog: "/" } }), { blog: "/" }],
])("readConfigSections(%p) is %p", (source, expected) => {
  expect(readConfigSections(source)).toEqual(expected);
});

test("blog.json rejects sections the dashboard would reject", () => {
  const result = siteConfigSchema.safeParse({
    name: "Acme",
    sections: { blog: "/blog", changelog: "/blog" },
  });
  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(
    "Blog and changelog need different paths"
  );
});
