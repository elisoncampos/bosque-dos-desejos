import { eq } from "drizzle-orm";
import { players } from "@/db/schema";
import { PUZZLES } from "@/lib/puzzles";
import { ApiError, assertMutation, body, database, handle, json, rateLimit, requireSession } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handle(async () => {
    assertMutation(request);
    const data = await body(request);
    const db = await database();
    const session = await requireSession(request, db, "player");
    if (!session.playerId) throw new ApiError(401, "authentication_required", "Entre no bosque novamente.");
    await rateLimit(request, db, "checkpoint", 40, 60);
    const campfire = PUZZLES.campfires.find((item) => item.id === data.campfireId);
    const position = data.position as { x?: number; z?: number } | undefined;
    if (!campfire || !position || typeof position.x !== "number" || typeof position.z !== "number" || !Number.isFinite(position.x) || !Number.isFinite(position.z) || Math.hypot(position.x - campfire.x, position.z - campfire.z) > 5) {
      throw new ApiError(400, "too_far", "Chegue mais perto da fogueira para guardar o lugar.");
    }
    await db.update(players).set({ checkpointX: campfire.x, checkpointZ: campfire.z, lastSeenAt: Date.now() }).where(eq(players.id, session.playerId));
    return json({ checkpoint: { x: campfire.x, z: campfire.z }, message: `${campfire.name}. ${campfire.message}` });
  });
}
