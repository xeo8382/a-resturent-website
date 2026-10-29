import "dotenv/config";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
// Transactional runner for checked-in Prisma-generated PostgreSQL SQL. No shadow DB or native engines.
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function main() {
  await client.connect();
  await client.query(
    "SELECT pg_advisory_lock(hashtext('ember_schema_migrations'))",
  );
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_ember_migrations" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const migrations = (
      await readdir("prisma/migrations", { withFileTypes: true })
    )
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const name of migrations) {
      const sql = await readFile(
        join("prisma/migrations", name, "migration.sql"),
        "utf8",
      );
      if (!sql.trim()) throw new Error(`Empty migration: ${name}`);
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM "_ember_migrations" WHERE name = $1',
        [name],
      );
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(
            `Applied migration changed: ${name}. Create a new migration instead.`,
          );
        console.log(`Already applied: ${name}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_ember_migrations" (name, checksum) VALUES ($1, $2)',
          [name, checksum],
        );
        await client.query("COMMIT");
        console.log(`Applied: ${name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query(
      "SELECT pg_advisory_unlock(hashtext('ember_schema_migrations'))",
    );
  }
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Migration failed");
    process.exitCode = 1;
  })
  .finally(() => client.end());
