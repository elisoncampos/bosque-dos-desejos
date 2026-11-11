import { and, eq } from "drizzle-orm";
import { discoveries, players, puzzleEvents } from "@/db/schema";
import { GIFTS, isChestId, isNearChest, publicDiscovery } from "@/lib/server/gifts";
import { ApiError, assertMutation, body, database, handle, json, rateLimit, requireSession } from "@/lib/server/http";
import { emailConfigured, notifyDiscovery } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handle(async () => {
    assertMutation(request);
    const data = await body(request);
    const db = await database();
    const session = await requireSession(request, db, "player");
    if (!session.playerId) throw new ApiError(401, "authentication_required", "Entre no bosque novamente.");
    await rateLimit(request, db, "discover", 90, 60);
    if (!isChestId(data.chestId)) throw new ApiError(400, "invalid_chest", "Este baú não faz parte do bosque.");
    if (!isNearChest(data.chestId, data.position)) throw new ApiError(400, "too_far", "Aproxime-se do baú para abrir seu presente.");
    const chestId = data.chestId;
    const required = chestId === "wish" ? "bridge" : chestId === "creation" ? "seal" : null;
    if (required) {
      const progress = await db.select().from(puzzleEvents).where(eq(puzzleEvents.playerId, session.playerId));
      if (!progress.some(row => row.action === required)) throw new ApiError(403, "puzzle_locked", "Ainda há um obstáculo entre você e este baú.");
    }
    if (chestId === "horizon") {
      const found = await db.select({ chestId: discoveries.chestId }).from(discoveries).where(eq(discoveries.playerId, session.playerId));
      if (["ember", "feast", "wish", "creation"].some((id) => !found.some((item) => item.chestId === id))) {
        throw new ApiError(403, "chest_locked", "Este segredo só desperta depois que os outros quatro presentes forem encontrados.");
      }
    }
    const now = Date.now();
    const [created] = await db.insert(discoveries).values({
      id: crypto.randomUUID(),
      playerId: session.playerId,
      chestId,
      discoveredAt: now,
      notificationStatus: emailConfigured() ? "pending" : "not_configured",
    }).onConflictDoNothing({ target: [discoveries.playerId, discoveries.chestId] }).returning();
    if (!created) {
      const [existing] = await db.select().from(discoveries).where(and(eq(discoveries.playerId, session.playerId), eq(discoveries.chestId, chestId))).limit(1);
      if (!existing) throw new Error("Idempotent discovery could not be loaded.");
      return json({ ...publicDiscovery(existing), discovery: publicDiscovery(existing), alreadyDiscovered: true, storage: "server" });
    }
    await db.update(players).set({ lastSeenAt: now }).where(eq(players.id, session.playerId));
    if (emailConfigured()) {
      const [player] = await db.select({ name: players.name }).from(players).where(eq(players.id, session.playerId)).limit(1);
      await notifyDiscovery(db, { id: created.id, playerName: player?.name ?? "Júlia", title: GIFTS[chestId].title, discoveredAt: now });
    }
    return json({ ...publicDiscovery(created), discovery: publicDiscovery(created), alreadyDiscovered: false, storage: "server" }, 201);
  });
}
