export type SessionClaims = { v: 1; role: "player" | "admin"; sid: string; exp: number };

const encoder = new TextEncoder();

function base64url(value: Uint8Array) {
  return btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode64(value: string) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (character) => character.charCodeAt(0));
}

async function keyFor(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function digest(secret: string, value: string) {
  const signature = await crypto.subtle.sign("HMAC", await keyFor(secret), encoder.encode(value));
  return base64url(new Uint8Array(signature));
}

export async function signSession(claims: SessionClaims, secret: string) {
  const body = base64url(encoder.encode(JSON.stringify(claims)));
  return `${body}.${await digest(secret, body)}`;
}

export async function verifySession(token: string, role: SessionClaims["role"], secret: string, now = Date.now()): Promise<SessionClaims | null> {
  try {
    if (token.length > 2048) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const valid = await crypto.subtle.verify("HMAC", await keyFor(secret), decode64(signature), encoder.encode(body));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode64(body))) as SessionClaims;
    if (claims.v !== 1 || claims.role !== role || typeof claims.sid !== "string" || !/^[a-f0-9-]{36}$/.test(claims.sid) || !Number.isFinite(claims.exp) || claims.exp <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function passwordsMatch(input: string, expected: string, secret: string) {
  const [left, right] = await Promise.all([digest(secret, input), digest(secret, expected)]);
  let difference = left.length ^ right.length;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

export function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1) ?? null;
}

export function sameOrigin(request: Request, configuredOrigin?: string) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    return origin === new URL(configuredOrigin || request.url).origin;
  } catch {
    return false;
  }
}
