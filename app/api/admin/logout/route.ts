import { eq } from "drizzle-orm";
import { sessions } from "@/db/schema";
import { assertMutation, database, handle, json, readSession, sessionCookie } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handle(async () => {
    assertMutation(request);
    const db = await database();
    const session = await readSession(request, db, "admin");
    if (session) await db.delete(sessions).where(eq(sessions.id, session.id));
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, "admin", "", 0) });
  });
}
