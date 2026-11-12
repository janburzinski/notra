"use client";

import { useState } from "react";

import { CodeBlock, CodeBlockTabs } from "../components/code-block";

const SNIPPETS = {
  next: {
    file: "proxy.ts",
    code: `import { withGeo } from "@usenotra/geo/next";

export const proxy = withGeo({
  token: process.env.NOTRA_GEO_TOKEN,
});

export const config = { matcher: ["/((?!_next|api).*)"] };`,
  },
  astro: {
    file: "src/middleware.ts",
    code: `import { geoMiddleware } from "@usenotra/geo/astro";

export const onRequest = geoMiddleware({
  token: import.meta.env.NOTRA_GEO_TOKEN,
});`,
  },
} as const;

const FRAMEWORKS = [
  { value: "next", label: "Next.js" },
  { value: "astro", label: "Astro" },
] as const;

export default function CodeBlockDemo() {
  const [framework, setFramework] = useState<keyof typeof SNIPPETS>("next");
  const snippet = SNIPPETS[framework];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
      <CodeBlock
        code={snippet.code}
        filename={snippet.file}
        tabs={
          <CodeBlockTabs
            label="Framework"
            onValueChange={(value) => {
              if (value === "next" || value === "astro") {
                setFramework(value);
              }
            }}
            options={FRAMEWORKS}
            value={framework}
          />
        }
      />
      <CodeBlock code="NOTRA_GEO_TOKEN=ntr_geo_••••••••" variant="command" />
    </div>
  );
}
