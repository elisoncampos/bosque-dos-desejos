import { count, desc, eq, sql } from "drizzle-orm";
import { discoveries, players } from "@/db/schema";
import { CHEST_IDS } from "@/lib/maze";
import { GIFTS, publicDiscovery } from "@/lib/server/gifts";
import { database, handle, json, requireSession } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(async () => {
    const db = await database();
    await requireSession(request, db, "admin");
    const [people, found, playerCount, discoveryCount, grouped, completed] = await Promise.all([
      db.select({ id: players.id, name: players.name, createdAt: players.createdAt, lastSeenAt: players.lastSeenAt, discoveryCount: count(discoveries.id) }).from(players).leftJoin(discoveries, eq(players.id, discoveries.playerId)).groupBy(players.id).orderBy(desc(players.lastSeenAt)).limit(200),
      db.select({ id: discoveries.id, playerId: discoveries.playerId, playerName: players.name, chestId: discoveries.chestId, discoveredAt: discoveries.discoveredAt, notificationStatus: discoveries.notificationStatus }).from(discoveries).innerJoin(players, eq(discoveries.playerId, players.id)).orderBy(desc(discoveries.discoveredAt)).limit(500),
      db.select({ value: count() }).from(players),
      db.select({ value: count() }).from(discoveries),
      db.select({ chestId: discoveries.chestId, value: count() }).from(discoveries).groupBy(discoveries.chestId),
      db.select({ playerId: discoveries.playerId }).from(discoveries).groupBy(discoveries.playerId).having(sql`count(*) >= ${CHEST_IDS.length}`),
    ]);
    return json({
      players: people.map((player) => ({ ...player, createdAt: new Date(player.createdAt).toISOString(), lastSeenAt: new Date(player.lastSeenAt).toISOString() })),
      discoveries: found.map((discovery) => ({ ...discovery, ...publicDiscovery(discovery) })),
      totals: {
        players: playerCount[0].value,
        discoveries: discoveryCount[0].value,
        completedPlayers: completed.length,
        byChest: CHEST_IDS.map((chestId) => ({ chestId, title: GIFTS[chestId].title, count: grouped.find((item) => item.chestId === chestId)?.value ?? 0 })),
      },
    });
  });
}
