import { expect, test } from "bun:test";

import { assertPublicHttpUrl, PublicUrlValidationError } from "../src/url";

test.each([
  "http://192.0.0.8/",
  "http://198.18.0.1/",
  "http://[64:ff9b::a9fe:a9fe]/",
  "http://[64:ff9b:1::a9fe:a9fe]/",
  "http://[100::1]/",
  "http://[2001::a9fe:a9fe]/",
  "http://[2001:db8::1]/",
  "http://[2002:a9fe:a9fe::]/",
  "http://[::ffff:0:a9fe:a9fe]/",
])("rejects reserved or translated destination %s", (url) => {
  expect(() => assertPublicHttpUrl(url)).toThrow(PublicUrlValidationError);
});

test.each([
  "https://8.8.8.8/",
  "https://[2606:4700:4700::1111]/",
  "https://[::ffff:8.8.8.8]/",
])("keeps public address %s available", (url) => {
  expect(() => assertPublicHttpUrl(url)).not.toThrow();
});
