"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createDeal(formData: FormData) {
  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  const montant = parseFloat(formData.get("montantEstime") as string);
  if (isNaN(montant) || montant <= 0) throw new Error("Le montant est requis");

  const clientId = parseInt(formData.get("clientId") as string);
  if (isNaN(clientId)) throw new Error("Le client est requis");

  await prisma.deal.create({
    data: {
      titre: titre.trim(),
      clientId,
      montantEstime: montant,
      etape: (formData.get("etape") as string) || "Prospect",
      montantFinal: formData.get("montantFinal")
        ? parseFloat(formData.get("montantFinal") as string)
        : null,
      dateSignature: formData.get("dateSignature")
        ? new Date(formData.get("dateSignature") as string)
        : null,
    },
  });

  revalidatePath("/crm");
}

export async function updateDeal(dealId: number, formData: FormData) {
  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  const montant = parseFloat(formData.get("montantEstime") as string);
  if (isNaN(montant) || montant <= 0) throw new Error("Le montant est requis");

  const clientId = parseInt(formData.get("clientId") as string);
  if (isNaN(clientId)) throw new Error("Le client est requis");

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      titre: titre.trim(),
      clientId,
      montantEstime: montant,
      etape: (formData.get("etape") as string) || "Prospect",
      montantFinal: formData.get("montantFinal")
        ? parseFloat(formData.get("montantFinal") as string)
        : null,
      dateSignature: formData.get("dateSignature")
        ? new Date(formData.get("dateSignature") as string)
        : null,
    },
  });

  revalidatePath("/crm");
}

export async function updateDealEtape(dealId: number, etape: string) {
  const valid = ["Prospect", "Qualification", "Proposition", "Gagné", "Perdu"];
  if (!valid.includes(etape)) throw new Error("Étape invalide");

  await prisma.deal.update({
    where: { id: dealId },
    data: { etape },
  });

  revalidatePath("/crm");
}

export async function deleteDeal(dealId: number) {
  await prisma.deal.delete({ where: { id: dealId } });
  revalidatePath("/crm");
}

export async function createClient(formData: FormData) {
  const nom = formData.get("nom") as string;
  if (!nom?.trim()) throw new Error("Le nom est requis");

  const email = formData.get("email") as string;
  if (!email?.trim()) throw new Error("L'email est requis");

  const client = await prisma.client.create({
    data: {
      nom: nom.trim(),
      email: email.trim(),
      telephone: (formData.get("telephone") as string)?.trim() || null,
      entreprise: (formData.get("entreprise") as string)?.trim() || null,
    },
  });

  revalidatePath("/crm");

  return { id: client.id, name: client.entreprise || client.nom };
}
