import { createClient, type Client } from "@libsql/client";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function resolveDatabaseUrl() {
  const configured = process.env.TURSO_DATABASE_URL?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) throw new Error("TURSO_DATABASE_URL is required on Vercel.");
  const directory = path.join(process.cwd(), ".data");
  mkdirSync(directory, { recursive: true });
  return `file:${path.join(directory, "bosque.db")}`;
}

export function createDatabaseClient() {
  const url = resolveDatabaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  return createClient({ url, ...(authToken ? { authToken } : {}) });
}

export async function migrate(client: Client) {
  await client.execute("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY)");
  const directory = path.join(process.cwd(), "drizzle");
  if (!existsSync(directory)) throw new Error("drizzle migrations directory is missing.");
  const files = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const existing = await client.execute({ sql: "SELECT id FROM schema_migrations WHERE id = ?", args: [file] });
    if (existing.rows.length > 0) continue;
    const statements = readFileSync(path.join(directory, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    try {
      await client.batch(
        [
          ...statements.map((sql) => ({ sql, args: [] })),
          { sql: "INSERT INTO schema_migrations (id) VALUES (?)", args: [file] },
        ],
        "write",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists/i.test(message)) throw error;
      await client.execute({ sql: "INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)", args: [file] });
    }
  }
}
