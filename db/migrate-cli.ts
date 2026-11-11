import { existsSync, readFileSync } from "node:fs";
import { createDatabaseClient, migrate } from "./migrate.ts";

const preexisting = new Set(Object.keys(process.env));

function loadEnvFile(file: string, override: boolean) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (preexisting.has(key)) continue;
    if (!override && process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

const client = createDatabaseClient();
await migrate(client);
client.close();
console.log("Migrações aplicadas.");
