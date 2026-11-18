"use client";

import { useState } from "react";

import { CodeBlock, CodeBlockTabs } from "../components/code-block";

const SNIPPETS = {
  next: {
    file: "proxy.ts",
    code: `import { createGeoProxy } from "@usenotra/sdk/next";
import { after, NextResponse } from "next/server";

const geo = createGeoProxy({
  token: process.env.NOTRA_GEO_TOKEN!,
});

export function proxy(request: Request) {
  after(() => geo(request));
  return NextResponse.next();
}`,
  },
  astro: {
    file: "src/middleware.ts",
    code: `import { createGeoMiddleware } from "@usenotra/sdk/astro";

export const onRequest = createGeoMiddleware({
  token: import.meta.env.NOTRA_GEO_TOKEN!,
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
