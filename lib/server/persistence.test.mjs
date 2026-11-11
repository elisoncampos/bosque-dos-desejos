import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const directory = new URL("../../drizzle/", import.meta.url);
  const migrations = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  assert.ok(migrations.length, "Generate the actual D1 migration before running persistence tests.");
  for (const migration of migrations) db.exec(readFileSync(new URL(migration, directory), "utf8"));
  return db;
}

test("a duplicate chest is saved once per player, while another player has independent progress", () => {
  const db = database();
  try {
    const insertPlayer = db.prepare("INSERT INTO players (id, name, created_at, last_seen_at) VALUES (?, ?, 1000, 1000)");
    insertPlayer.run("first", "Júlia");
    insertPlayer.run("second", "Outra sessão");
    const discover = db.prepare("INSERT INTO discoveries (id, player_id, chest_id, discovered_at, notification_status) VALUES (?, ?, ?, 1000, 'not_configured') ON CONFLICT (player_id, chest_id) DO NOTHING RETURNING id");
    assert.equal(discover.get("discovery-1", "first", "ember").id, "discovery-1");
    assert.equal(discover.get("discovery-retry", "first", "ember"), undefined);
    assert.equal(discover.get("discovery-2", "second", "ember").id, "discovery-2");
    assert.equal(db.prepare("SELECT count(*) AS total FROM discoveries").get().total, 2);
    assert.throws(() => discover.get("orphan", "missing-player", "feast"), /FOREIGN KEY/);
  } finally { db.close(); }
});

test("revoking an admin session removes its server authority and does not delete game progress", () => {
  const db = database();
  try {
    db.prepare("INSERT INTO players (id, name, created_at, last_seen_at) VALUES ('player', 'Júlia', 1000, 1000)").run();
    db.prepare("INSERT INTO discoveries (id, player_id, chest_id, discovered_at) VALUES ('gift', 'player', 'ember', 1000)").run();
    db.prepare("INSERT INTO sessions (id, role, player_id, created_at, expires_at) VALUES ('admin-session', 'admin', NULL, 1000, 5000)").run();
    db.prepare("DELETE FROM sessions WHERE id = ?").run("admin-session");
    assert.equal(db.prepare("SELECT * FROM sessions WHERE id = ?").get("admin-session"), undefined);
    assert.equal(db.prepare("SELECT count(*) AS total FROM discoveries").get().total, 1);
  } finally { db.close(); }
});
