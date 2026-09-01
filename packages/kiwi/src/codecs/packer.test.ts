import { expect, test } from "bun:test";

import { packBuffer, unpackBuffer } from "./packer";

test("packs and unpacks both independent chunks", async () => {
  const schema = new TextEncoder().encode("schema".repeat(1000));
  const data = new Uint8Array(16_384);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = index % 251;
  }

  const packed = await packBuffer(schema, data);
  const unpacked = await unpackBuffer(packed);

  expect(unpacked.schema).toEqual(schema);
  expect(unpacked.data).toEqual(data);
});

test("packing remains deterministic when chunks compress concurrently", async () => {
  const schema = new TextEncoder().encode("schema payload");
  const data = new TextEncoder().encode("scene payload");

  const [first, second] = await Promise.all([
    packBuffer(schema, data),
    packBuffer(schema, data),
  ]);

  expect(first).toEqual(second);
});
