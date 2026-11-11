import { eq } from "drizzle-orm";
import { discoveries, players } from "@/db/schema";
import { publicDiscovery } from "@/lib/server/gifts";
import { ApiError, assertMutation, body, database, handle, json, newSession, rateLimit, readSession } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(async () => {
    const db = await database();
    const session = await readSession(request, db, "player");
    if (!session?.playerId) return json({ playerId: null, discoveries: [], checkpoint: null, storage: "server" });
    const rows = await db.select().from(discoveries).where(eq(discoveries.playerId, session.playerId));
    const [player] = await db.select({ x: players.checkpointX, z: players.checkpointZ }).from(players).where(eq(players.id, session.playerId));
    const checkpoint = player?.x != null && player.z != null ? { x: player.x, z: player.z } : null;
    return json({ playerId: session.playerId, discoveries: rows.map(publicDiscovery), checkpoint, storage: "server" });
  });
}

export function POST(request: Request) {
  return handle(async () => {
    assertMutation(request);
    const data = await body(request);
    const db = await database();
    const session = await readSession(request, db, "player");
    if (session?.playerId) {
      await db.update(players).set({ lastSeenAt: Date.now() }).where(eq(players.id, session.playerId));
      const rows = await db.select().from(discoveries).where(eq(discoveries.playerId, session.playerId));
      const [player] = await db.select({ x: players.checkpointX, z: players.checkpointZ }).from(players).where(eq(players.id, session.playerId));
      const checkpoint = player?.x != null && player.z != null ? { x: player.x, z: player.z } : null;
      return json({ playerId: session.playerId, discoveries: rows.map(publicDiscovery), checkpoint, storage: "server" });
    }
    await rateLimit(request, db, "new-player", 20, 3600);
    if (data.name !== undefined && typeof data.name !== "string") throw new ApiError(400, "invalid_name", "Informe um nome válido.");
    const name = (typeof data.name === "string" ? data.name : "Júlia").trim().replace(/[\u0000-\u001f\u007f]/g, "");
    if (!name || name.length > 60) throw new ApiError(400, "invalid_name", "O nome deve ter entre 1 e 60 caracteres.");
    const now = Date.now();
    const playerId = crypto.randomUUID();
    await db.insert(players).values({ id: playerId, name, createdAt: now, lastSeenAt: now });
    const cookie = await newSession(request, db, "player", playerId);
    return json({ playerId, discoveries: [], checkpoint: null, storage: "server" }, 201, { "Set-Cookie": cookie });
  });
}
