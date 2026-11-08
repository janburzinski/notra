import { expect, test } from "bun:test";

import {
  webErrors,
  webEvents,
  webPageEngagement,
  webPageViews,
} from "../datasources";
import { webOutboundLinks } from "./web-events";

test("events and errors expire with the other raw web datasources", () => {
  const ttl = (datasource: typeof webPageViews) =>
    datasource.options.engine && "ttl" in datasource.options.engine
      ? datasource.options.engine.ttl
      : undefined;
  expect(ttl(webPageViews)).toBe("captured_at + toIntervalDay(90)");
  for (const datasource of [webEvents, webErrors, webPageEngagement]) {
    expect(ttl(datasource as unknown as typeof webPageViews)).toBe(
      ttl(webPageViews)
    );
  }
});

test("outbound links read only the clicks notra.js stores as Outbound", () => {
  expect(webOutboundLinks.options.nodes[0]?.sql).toContain("name = 'Outbound'");
});
