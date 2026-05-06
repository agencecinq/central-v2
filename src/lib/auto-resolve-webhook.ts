import { createHmac } from "crypto";

/**
 * Émet le webhook `ticket.created` vers le worker auto-resolve.
 * Fire-and-forget : ne bloque jamais le flow utilisateur. Les erreurs sont loggées
 * mais pas remontées (le worker a sa propre tolérance aux retries).
 */
export function emitTicketCreatedWebhook(payload: {
  ticketId: number;
  projectId: number;
  actorEmail?: string | null;
  actorUserId?: number | null;
}): void {
  const url = process.env.AUTORESOLVE_WORKER_URL;
  const secret = process.env.AUTORESOLVE_WEBHOOK_SECRET;

  if (!url || !secret) {
    // Worker non configuré (dev local par défaut) — silencieux.
    return;
  }

  const body = JSON.stringify({
    event: "ticket.created",
    ticket_id: payload.ticketId,
    project_id: payload.projectId,
    created_at: new Date().toISOString(),
    actor: {
      user_id: payload.actorUserId ?? null,
      email: payload.actorEmail ?? null,
    },
  });

  const signature = createHmac("sha256", secret).update(body).digest("hex");

  // Fire-and-forget. Catch any error to avoid unhandled rejection.
  fetch(`${url.replace(/\/$/, "")}/webhooks/cinqcentral/ticket-created`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cinqcentral-signature": `sha256=${signature}`,
    },
    body,
  }).catch((err) => {
    console.error("[auto-resolve] webhook emit failed:", err);
  });
}
