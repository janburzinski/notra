import { expect, test } from "bun:test";

import { formatCsvFileSize } from "./geo-import";

test("formatCsvFileSize pluralizes bytes and keeps larger units short", () => {
  expect(formatCsvFileSize(1, "en")).toBe("1 byte");
  expect(formatCsvFileSize(6, "en")).toBe("6 bytes");
  expect(formatCsvFileSize(6, "de")).toBe("6 Byte");
  expect(formatCsvFileSize(37_189, "en")).toBe("36 kB");
  expect(formatCsvFileSize(5 * 1024 * 1024, "en")).toBe("5 MB");
});
