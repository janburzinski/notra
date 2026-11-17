import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../../../messages/en.json";
import { GeoCountCell } from "./geo-count-cell";

test.each([
  [5, 4, "+25%"],
  [3, 6, "-50%"],
  [3, 3, "0%"],
  [1, 0, "New"],
] as const)(
  "the GEO count cell shows the change for %d/%d",
  (value, previousValue, change) => {
    const html = renderToStaticMarkup(
      <IntlProvider locale="en" messages={messages} timeZone="UTC">
        <GeoCountCell
          label="Example"
          previousValue={previousValue}
          value={value}
        />
      </IntlProvider>
    );
    expect(html).toContain(`${change}</span>`);
  }
);

test("unknown comparison does not become a fabricated new-traffic badge", () => {
  const html = renderToStaticMarkup(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <GeoCountCell
        label="Example"
        previousValue={null}
        unavailableHint="Comparison unavailable"
        value={5}
      />
    </IntlProvider>
  );
  expect(html).toContain("Comparison unavailable");
  expect(html).not.toContain("New");
  expect(html).not.toMatch(/>[^<]*0%[^<]*</);
});
