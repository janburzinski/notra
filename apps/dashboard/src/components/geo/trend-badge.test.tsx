import { expect, test } from "bun:test";

import { TrendBadge } from "@notra/ui/components/trend-badge";
import { renderToStaticMarkup } from "react-dom/server";

test.each(["plain", "badge"] as const)(
  "%s trends support custom rendering",
  (appearance) => {
    const html = renderToStaticMarkup(
      <TrendBadge
        appearance={appearance}
        render={<a href="/details" />}
        tone="up"
      >
        +12%
      </TrendBadge>
    );
    expect(html).toStartWith("<a ");
    expect(html).toContain('href="/details"');
    expect(html).toContain("+12%");
    expect(html).not.toContain("render=");
  }
);
