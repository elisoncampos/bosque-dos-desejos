import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { rateLimits, sessions } from "@/db/schema";
import { cookieValue, digest, sameOrigin, signSession, verifySession, type SessionClaims } from "./security";

type SecretName = "SESSION_SECRET" | "ADMIN_PASSWORD" | "RESEND_API_KEY" | "RESEND_FROM" | "NOTIFY_EMAIL" | "APP_ORIGIN";

const settings = {
  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_FROM: process.env.RESEND_FROM ?? "",
  NOTIFY_EMAIL: process.env.NOTIFY_EMAIL ?? "",
  APP_ORIGIN: process.env.APP_ORIGIN ?? "",
} satisfies Record<SecretName, string>;

export function setting(name: SecretName) {
  return settings[name];
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) { super(message); }
}

export function sessionSecret() {
  const secret = setting("SESSION_SECRET");
  if (secret.length < 32) throw new ApiError(503, "configuration_required", "O bosque precisa ser configurado pelo administrador antes de salvar seu progresso.");
  return secret;
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export async function handle(operation: () => Promise<Response>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status, error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined);
    console.error("Bosque API failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Não foi possível acessar o registro do bosque. Tente novamente em instantes.", code: "database_unavailable" }, 503);
  }
}

export function assertMutation(request: Request) {
  if (!sameOrigin(request, setting("APP_ORIGIN"))) throw new ApiError(403, "invalid_origin", "Esta ação precisa ser feita dentro do bosque.");
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new ApiError(415, "invalid_body", "Envie os dados como JSON.");
  const text = await request.text();
  if (text.length > 4096) throw new ApiError(413, "invalid_body", "Os dados enviados são muito grandes.");
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new ApiError(400, "invalid_body", "Não foi possível entender os dados enviados."); }
}

export async function database() {
  sessionSecret();
  try { return await getDb(); }
  catch (error) {
    console.error("Bosque database unavailable", error instanceof Error ? error.message : "Unknown error");
    throw new ApiError(503, "database_unavailable", "O banco de dados do bosque ainda não está disponível.");
  }
}

export const COOKIE_NAMES = { player: "bosque_player", admin: "bosque_admin" } as const;
export const SESSION_DURATION = { player: 365 * 24 * 60 * 60 * 1000, admin: 12 * 60 * 60 * 1000 };

export function sessionCookie(request: Request, role: SessionClaims["role"], value: string, maxAge: number) {
  const url = new URL(request.url);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const secure = url.protocol === "https:" || !isLoopback ? "; Secure" : "";
  return `${COOKIE_NAMES[role]}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function readSession(request: Request, db: Database, role: SessionClaims["role"]) {
  const token = cookieValue(request, COOKIE_NAMES[role]);
  if (!token) return null;
  const claims = await verifySession(token, role, sessionSecret());
  if (!claims) return null;
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, claims.sid), eq(sessions.role, role), gt(sessions.expiresAt, Date.now()))).limit(1);
  return session ?? null;
}

export async function requireSession(request: Request, db: Database, role: SessionClaims["role"]) {
  const session = await readSession(request, db, role);
  if (!session) throw new ApiError(401, "authentication_required", role === "admin" ? "Entre com a senha do guardião." : "Entre no bosque para salvar as descobertas.");
  return session;
}

export async function newSession(request: Request, db: Database, role: SessionClaims["role"], playerId: string | null = null) {
  const now = Date.now();
  const record = { id: crypto.randomUUID(), role, playerId, createdAt: now, expiresAt: now + SESSION_DURATION[role] };
  await db.insert(sessions).values(record);
  const token = await signSession({ v: 1, role, sid: record.id, exp: record.expiresAt }, sessionSecret());
  return sessionCookie(request, role, token, SESSION_DURATION[role] / 1000);
}

export async function rateLimit(request: Request, db: Database, action: string, maximum: number, windowSeconds: number) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const window = Math.floor(now / windowMs);
  const identity = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "local-or-shared";
  const id = await digest(sessionSecret(), `${action}:${identity}:${window}`);
  const expiresAt = (window + 1) * windowMs;
  const [entry] = await db.insert(rateLimits).values({ id, attempts: 1, expiresAt }).onConflictDoUpdate({ target: rateLimits.id, set: { attempts: sql`${rateLimits.attempts} + 1` } }).returning({ attempts: rateLimits.attempts });
  // Expired counters contain no useful data and should not accumulate indefinitely.
  await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now - 24 * 60 * 60 * 1000));
  if (entry.attempts > maximum) throw new ApiError(429, "rate_limited", "Muitas tentativas. Aguarde um pouco antes de tentar novamente.", Math.ceil((expiresAt - now) / 1000));
}
