import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  role: text("role", { enum: ["player", "admin"] }).notNull(),
  playerId: text("player_id").references(() => players.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("sessions_expiry_idx").on(table.expiresAt)]);

export const discoveries = sqliteTable("discoveries", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  chestId: text("chest_id").notNull(),
  discoveredAt: integer("discovered_at").notNull(),
  notificationStatus: text("notification_status", { enum: ["pending", "sent", "failed", "not_configured"] }).notNull().default("not_configured"),
}, (table) => [
  uniqueIndex("discoveries_player_chest_unique").on(table.playerId, table.chestId),
  index("discoveries_time_idx").on(table.discoveredAt),
]);

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  attempts: integer("attempts").notNull().default(1),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("rate_limits_expiry_idx").on(table.expiresAt)]);
