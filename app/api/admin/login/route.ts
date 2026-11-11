import { eq } from "drizzle-orm";
import { sessions } from "@/db/schema";
import { ApiError, assertMutation, body, database, handle, json, newSession, rateLimit, readSession, sessionSecret, setting } from "@/lib/server/http";
import { passwordsMatch } from "@/lib/server/security";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handle(async () => {
    assertMutation(request);
    const data = await body(request);
    const password = setting("ADMIN_PASSWORD");
    if (password.length < 12) throw new ApiError(503, "configuration_required", "Configure uma senha de administrador com pelo menos 12 caracteres no servidor.");
    const db = await database();
    await rateLimit(request, db, "admin-login", 5, 15 * 60);
    if (typeof data.password !== "string" || data.password.length > 512 || !(await passwordsMatch(data.password, password, sessionSecret()))) {
      throw new ApiError(401, "invalid_password", "A senha do guardião não está correta.");
    }
    const previous = await readSession(request, db, "admin");
    if (previous) await db.delete(sessions).where(eq(sessions.id, previous.id));
    const cookie = await newSession(request, db, "admin");
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  });
}
