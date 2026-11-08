import { expect, test } from "bun:test";

import { geoWebScriptTag } from "../src/utils/web-script-tag";

const SCRIPT = {
  url: "https://ingest.example/api/notra.js",
  pinnedUrl: "https://ingest.example/api/notra.0123456789ab.js",
  integrity: "sha384-abc",
};

test("the default tag auto-updates; the pinned one checks its integrity", () => {
  expect(geoWebScriptTag("nwk.key", SCRIPT)).toBe(
    '<script defer src="https://ingest.example/api/notra.js" data-key="nwk.key"></script>'
  );
  expect(geoWebScriptTag("nwk.key", SCRIPT, true)).toBe(
    '<script defer src="https://ingest.example/api/notra.0123456789ab.js" data-key="nwk.key" integrity="sha384-abc" crossorigin="anonymous"></script>'
  );
});
