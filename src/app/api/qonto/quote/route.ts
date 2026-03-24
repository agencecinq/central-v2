import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  createQuote,
  updateQuote,
  type QontoQuoteItem,
  type QontoQuotePayload,
} from "@/lib/qonto";

export async function POST(request: Request) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { budgetId } = body as { budgetId: number };

  if (!budgetId) {
    return NextResponse.json({ error: "budgetId requis" }, { status: 400 });
  }

  // Load budget with all relations
  const budget = await prisma.propositionCommerciale.findUnique({
    where: { id: budgetId },
    include: {
      deal: {
        include: { client: true },
      },
      sections: {
        include: { sousSections: { orderBy: { ordre: "asc" } } },
        orderBy: { ordre: "asc" },
      },
    },
  });

  if (!budget) {
    return NextResponse.json({ error: "Budget introuvable" }, { status: 404 });
  }

  const client = budget.deal.client;
  if (!client.qontoClientId) {
    return NextResponse.json(
      { error: "Le client n'est pas lié à un client Qonto. Liez-le d'abord depuis la page du deal." },
      { status: 400 },
    );
  }

  // Build Qonto items from sections/sous-sections
  const items: QontoQuoteItem[] = [];

  for (const section of budget.sections) {
    for (const ss of section.sousSections) {
      const jours = Number(ss.nombreJours);
      const tjm = Number(ss.tjm);
      const remise = Number(ss.remise);

      const item: QontoQuoteItem = {
        title: ss.titre,
        description: `${jours.toFixed(1)} jour(s) × ${tjm.toFixed(0)} €/jour — ${section.titre}`,
        quantity: jours.toFixed(2),
        unit_price: {
          value: tjm.toFixed(2),
          currency: "EUR",
        },
        vat_rate: (Number(budget.tauxTva) / 100).toFixed(2),
      };

      if (remise > 0) {
        item.discount = {
          type: "percentage",
          value: (remise / 100).toFixed(4),
        };
      }

      items.push(item);
    }
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Le budget ne contient aucune sous-section." },
      { status: 400 },
    );
  }

  // Build payload
  const today = new Date();
  const expiry = new Date(today);
  expiry.setMonth(expiry.getMonth() + 3);

  const payload: QontoQuotePayload = {
    client_id: client.qontoClientId,
    issue_date: today.toISOString().split("T")[0],
    expiry_date: expiry.toISOString().split("T")[0],
    terms_and_conditions: budget.conclusion || "Conditions générales de vente",
    currency: "EUR",
    items,
  };

  const remiseGlobale = Number(budget.remiseGlobale);
  if (remiseGlobale > 0) {
    payload.discount = {
      type: "percentage",
      value: (remiseGlobale / 100).toFixed(4),
    };
  }

  try {
    const existingQuoteId = budget.deal.qontoQuoteId;
    let quote: { id: string; number: string };

    if (existingQuoteId) {
      quote = await updateQuote(existingQuoteId, payload);
    } else {
      quote = await createQuote(payload);
      // Save qontoQuoteId on the deal
      await prisma.deal.update({
        where: { id: budget.deal.id },
        data: { qontoQuoteId: quote.id },
      });
    }

    return NextResponse.json({
      ok: true,
      action: existingQuoteId ? "updated" : "created",
      quoteId: quote.id,
      quoteNumber: quote.number,
    });
  } catch (error) {
    console.error("Erreur création devis Qonto", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la création du devis Qonto",
      },
      { status: 502 },
    );
  }
}
