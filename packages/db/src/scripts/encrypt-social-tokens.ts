import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import {
  decodeIntegrationEncryptionKey,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../utils/integration-encryption";

// One-off backfill: copies plaintext social_connections.access_token into
// encrypted_access_token. Plaintext is kept so running releases and rollbacks
// keep working; a later migration drops it. Pass --apply to write.
const apply = process.argv.includes("--apply");
const databaseUrl =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL must be defined");
}
const key = decodeIntegrationEncryptionKey(
  process.env.INTEGRATION_ENCRYPTION_KEY
);

function decryptsTo(encrypted: string, expected: string) {
  try {
    return decryptIntegrationSecret(encrypted, key) === expected;
  } catch {
    return false;
  }
}

const db = drizzle({ connection: { connectionString: databaseUrl } });
try {
  await db.transaction(async (tx) => {
    if (!apply) {
      await tx.execute(sql`SET TRANSACTION READ ONLY`);
    }

    const { rows: pending } = await tx.execute<{
      id: string;
      access_token: string;
    }>(sql`
      SELECT id, access_token FROM social_connections
      WHERE access_token IS NOT NULL AND encrypted_access_token IS NULL
      ${apply ? sql`FOR UPDATE` : sql``}
    `);
    if (pending.length === 0) {
      console.log("[encrypt-social-tokens] nothing to encrypt");
      return;
    }

    // Tokens the running app already encrypted prove this is its key.
    const { rows: known } = await tx.execute<{
      access_token: string;
      encrypted_access_token: string;
    }>(sql`
      SELECT access_token, encrypted_access_token FROM social_connections
      WHERE access_token IS NOT NULL AND encrypted_access_token IS NOT NULL
    `);
    const keyMatches = known.filter((row) =>
      decryptsTo(row.encrypted_access_token, row.access_token)
    ).length;
    if (known.length === 0 || keyMatches !== known.length) {
      throw new Error(
        `[encrypt-social-tokens] key matched ${keyMatches}/${known.length} existing tokens; no changes made`
      );
    }

    const updates = pending.map((row) => {
      const encrypted = encryptIntegrationSecret(row.access_token, key);
      if (!decryptsTo(encrypted, row.access_token)) {
        throw new Error(
          `[encrypt-social-tokens] round-trip failed for ${row.id}; no changes made`
        );
      }
      return { ...row, encrypted };
    });

    if (!apply) {
      console.log(
        `[encrypt-social-tokens] dry run: key verified on ${known.length} rows, ${updates.length} rows would be encrypted`
      );
      return;
    }

    let written = 0;
    for (const update of updates) {
      const result = await tx.execute(sql`
        UPDATE social_connections
        SET encrypted_access_token = ${update.encrypted}
        WHERE id = ${update.id}
          AND encrypted_access_token IS NULL
          AND access_token = ${update.access_token}
      `);
      written += result.rowCount ?? 0;
    }
    if (written !== updates.length) {
      throw new Error(
        `[encrypt-social-tokens] expected ${updates.length} updates, got ${written}; rolled back`
      );
    }

    console.log(
      `[encrypt-social-tokens] key verified on ${known.length} rows, encrypted ${written} rows`
    );
  });
} finally {
  await db.$client.end();
}
