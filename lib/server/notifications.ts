import { eq } from "drizzle-orm";
import { Resend } from "resend";
import type { Database } from "@/db";
import { discoveries } from "@/db/schema";
import { setting } from "./http";

export function emailConfigured() {
  return !!(setting("RESEND_API_KEY") && setting("RESEND_FROM") && setting("NOTIFY_EMAIL"));
}

export async function notifyDiscovery(db: Database, discovery: { id: string; playerName: string; title: string; discoveredAt: number }) {
  if (!emailConfigured()) return;
  let status: "sent" | "failed" = "failed";
  try {
    const resend = new Resend(setting("RESEND_API_KEY"));
    const { error } = await resend.emails.send({
      from: setting("RESEND_FROM"),
      to: [setting("NOTIFY_EMAIL")],
      subject: `${discovery.playerName} encontrou um presente no bosque!`,
      text: `${discovery.playerName} encontrou: ${discovery.title}\n\nData: ${new Date(discovery.discoveredAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\nA descoberta já está salva no painel do guardião.`,
    }, { idempotencyKey: `bosque-discovery-${discovery.id}`, signal: AbortSignal.timeout(8000) });
    if (!error) status = "sent";
    else console.error("Discovery email rejected", error.name);
  } catch { console.error("Discovery email unavailable"); }
  // Email failure never undoes a saved gift. The admin panel displays the delivery result.
  try { await db.update(discoveries).set({ notificationStatus: status }).where(eq(discoveries.id, discovery.id)); }
  catch { console.error("Unable to persist notification status"); }
}
