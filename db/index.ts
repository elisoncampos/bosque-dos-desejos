import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { createDatabaseClient, migrate } from "./migrate.ts";

export type Database = LibSQLDatabase<typeof schema>;

let ready: Promise<Database> | null = null;

async function open() {
  const client = createDatabaseClient();
  await migrate(client);
  return drizzle(client, { schema });
}

export function getDb() {
  if (!ready) ready = open();
  return ready;
}
