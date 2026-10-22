import { Client } from "pg";
import * as z from "zod";

import {
  decodeIntegrationEncryptionKey,
  decodePreviousIntegrationEncryptionKey,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../utils/integration-encryption";

const dryRun = process.argv.includes("--dry-run");
const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const currentKey = decodeIntegrationEncryptionKey(
  process.env.INTEGRATION_ENCRYPTION_KEY
);
const maybePreviousKey = decodePreviousIntegrationEncryptionKey();

if (!databaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL must be defined");
}
if (!maybePreviousKey) {
  throw new Error("INTEGRATION_ENCRYPTION_KEY_PREVIOUS must be defined");
}
const previousKey = maybePreviousKey;

const encryptedColumnSchema = z.object({
  table_name: z.string(),
  column_name: z.string(),
  data_type: z.string(),
});
const encryptedHeadersSchema = z.record(z.string(), z.string());

function reencrypt(value: string) {
  try {
    decryptIntegrationSecret(value, currentKey);
    return value;
  } catch {
    return encryptIntegrationSecret(
      decryptIntegrationSecret(value, previousKey),
      currentKey
    );
  }
}

function reencryptColumnValue(value: unknown, dataType: string) {
  if (value === null) {
    return null;
  }
  if (dataType === "jsonb") {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(encryptedHeadersSchema.parse(value)).map(
          ([name, secret]) => [name, reencrypt(secret)]
        )
      )
    );
  }
  return reencrypt(z.string().parse(value));
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("BEGIN");
  const { rows: columnRows } = await client.query(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name LIKE 'encrypted\\_%'
     ORDER BY table_name, column_name`
  );
  const columnsByTable = new Map<
    string,
    z.infer<typeof encryptedColumnSchema>[]
  >();
  for (const column of z.array(encryptedColumnSchema).parse(columnRows)) {
    columnsByTable.set(column.table_name, [
      ...(columnsByTable.get(column.table_name) ?? []),
      column,
    ]);
  }

  for (const [table, columns] of columnsByTable) {
    const tableName = client.escapeIdentifier(table);
    const columnNames = columns.map((column) =>
      client.escapeIdentifier(column.column_name)
    );
    const { rows } = await client.query(
      `SELECT ctid::text AS row_id, ${columnNames.join(", ")} FROM ${tableName} FOR UPDATE`
    );
    let updated = 0;

    for (const row of rows) {
      const rowId = z.string().parse(row.row_id);
      const values = columns.map((column) => {
        try {
          return reencryptColumnValue(
            row[column.column_name],
            column.data_type
          );
        } catch (cause) {
          throw new Error(
            `${table}.${column.column_name} (ctid ${rowId}) decrypts with neither key`,
            { cause }
          );
        }
      });
      const original = columns.map((column) => {
        const value = row[column.column_name];
        return column.data_type === "jsonb" && value !== null
          ? JSON.stringify(value)
          : value;
      });
      if (values.every((value, index) => value === original[index])) {
        continue;
      }
      await client.query(
        `UPDATE ${tableName} SET ${columnNames
          .map((name, index) => `${name} = $${index + 2}`)
          .join(", ")} WHERE ctid = $1::tid`,
        [rowId, ...values]
      );
      updated += 1;
    }

    console.log(
      `[rotate] ${table}: ${updated}/${rows.length} rows re-encrypted`
    );
  }

  await client.query(dryRun ? "ROLLBACK" : "COMMIT");
  console.log(dryRun ? "[rotate] dry run, rolled back" : "[rotate] committed");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
