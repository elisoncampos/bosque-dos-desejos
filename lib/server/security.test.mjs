import assert from "node:assert/strict";
import test from "node:test";
import { passwordsMatch, sameOrigin, signSession, verifySession } from "./security.ts";

const secret = "test-only-unique-secret-with-at-least-32-characters";
const claims = { v: 1, role: "player", sid: "01d2f190-789a-4f31-9458-cd6879f75aaa", exp: 2000 };

test("a signed player cookie authenticates only its intended role and lifetime", async () => {
  const token = await signSession(claims, secret);
  assert.deepEqual(await verifySession(token, "player", secret, 1000), claims);
  assert.equal(await verifySession(token, "admin", secret, 1000), null);
  assert.equal(await verifySession(token, "player", secret, 2000), null);
  assert.equal(await verifySession(token, "player", `${secret}-rotated`, 1000), null);
});

test("tampering with the signed identity is rejected", async () => {
  const token = await signSession(claims, secret);
  const [, signature] = token.split(".");
  const forgedBody = Buffer.from(JSON.stringify({ ...claims, role: "admin" })).toString("base64url");
  assert.equal(await verifySession(`${forgedBody}.${signature}`, "admin", secret, 1000), null);
  for (const malformed of ["", "x.y.z", "not-a-cookie", "!.!", "a".repeat(3000)]) {
    assert.equal(await verifySession(malformed, "player", secret, 1000), null);
  }
});

test("password comparison distinguishes wrong credentials", async () => {
  assert.equal(await passwordsMatch("a complex password", "a complex password", secret), true);
  assert.equal(await passwordsMatch("wrong", "a complex password", secret), false);
  assert.equal(await passwordsMatch("", "a complex password", secret), false);
});

test("mutations require explicit same-origin browser provenance", () => {
  const url = "https://bosque.example/api/discover";
  assert.equal(sameOrigin(new Request(url, { headers: { origin: "https://bosque.example" } })), true);
  assert.equal(sameOrigin(new Request(url)), false);
  assert.equal(sameOrigin(new Request(url, { headers: { origin: "https://attacker.example" } })), false);
  assert.equal(sameOrigin(new Request(url, { headers: { origin: "https://bosque.example", "sec-fetch-site": "cross-site" } })), false);
  assert.equal(sameOrigin(new Request("https://internal.example/api/discover", { headers: { origin: "https://bosque.example" } }), "https://bosque.example"), true);
});
