import { prisma } from "@/lib/prisma";
import {
  getTotalBalance,
  getPendingInvoices,
} from "@/lib/qonto";

// ─── Projets actifs ─────────────────────────────────────────────────────────

export interface ActiveProject {
  id: number;
  titre: string;
  clientName: string | null;
  budgetTotal: number;
  budgetConsomme: number;
  budgetPct: number;
  statut: string;
  deadline: string | null;
}

export async function getActiveProjects(): Promise<ActiveProject[]> {
  const projects = await prisma.project.findMany({
    where: {
      statut: { in: ["en_cours", "en_attente"] },
      isPersonnel: false,
    },
    select: {
      id: true,
      titre: true,
      budgetTotal: true,
      budgetConsomme: true,
      statut: true,
      deadline: true,
      client: { select: { entreprise: true, nom: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return projects.map((p) => ({
    id: p.id,
    titre: p.titre,
    budgetTotal: Number(p.budgetTotal),
    budgetConsomme: Number(p.budgetConsomme),
    budgetPct:
      Number(p.budgetTotal) > 0
        ? Math.round((Number(p.budgetConsomme) / Number(p.budgetTotal)) * 100)
        : 0,
    statut: p.statut,
    deadline: p.deadline?.toISOString().split("T")[0] ?? null,
    clientName: p.client?.entreprise ?? p.client?.nom ?? null,
  }));
}

// ─── Tâches en cours ────────────────────────────────────────────────────────

export interface UserTask {
  id: number;
  titre: string;
  priorite: string;
  statutKanban: string;
  dateEcheance: string | null;
  projectId: number;
  projectTitre: string;
}

export async function getUserTasks(userId: number): Promise<UserTask[]> {
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      estTerminee: false,
      statutKanban: { in: ["todo", "in_progress", "review"] },
    },
    select: {
      id: true,
      titre: true,
      priorite: true,
      dateEcheance: true,
      statutKanban: true,
      project: { select: { id: true, titre: true } },
    },
    orderBy: [{ dateEcheance: "asc" }],
    take: 15,
  });

  return tasks.map((t) => ({
    id: t.id,
    titre: t.titre,
    priorite: t.priorite,
    statutKanban: t.statutKanban,
    dateEcheance: t.dateEcheance?.toISOString().split("T")[0] ?? null,
    projectId: t.project.id,
    projectTitre: t.project.titre,
  }));
}

// ─── Tickets ouverts ────────────────────────────────────────────────────────

export interface OpenTicket {
  id: number;
  titre: string;
  statut: string;
  createdAt: string | null;
  projectId: number;
  projectTitre: string;
  assigneName: string | null;
}

export async function getOpenTickets(): Promise<OpenTicket[]> {
  const tickets = await prisma.ticket.findMany({
    where: { statut: { in: ["ouvert", "en_cours"] } },
    select: {
      id: true,
      titre: true,
      statut: true,
      createdAt: true,
      project: { select: { id: true, titre: true } },
      assigne: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return tickets.map((t) => ({
    id: t.id,
    titre: t.titre,
    statut: t.statut,
    createdAt: t.createdAt?.toISOString() ?? null,
    projectId: t.project.id,
    projectTitre: t.project.titre,
    assigneName: t.assigne?.name ?? null,
  }));
}

// ─── Finance / CA ───────────────────────────────────────────────────────────

export interface FinanceSummary {
  balance: number | null;
  pendingCount: number;
  pendingTotal: number;
  resteAFacturer: number;
  dealsCount: number;
  qontoError: string | null;
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  let balance: number | null = null;
  let pendingCount = 0;
  let pendingTotal = 0;
  let qontoError: string | null = null;

  try {
    const [bal, pending] = await Promise.all([
      getTotalBalance(),
      getPendingInvoices(),
    ]);
    balance = bal;
    pendingCount = pending.length;
    pendingTotal = pending.reduce((sum, inv) => sum + inv.montantHT, 0);
  } catch (e) {
    qontoError = e instanceof Error ? e.message : "Erreur Qonto";
  }

  const deals = await prisma.deal.findMany({
    where: { etape: "Gagné", montantFinal: { not: null } },
    include: { dealFactures: true },
  });

  let resteAFacturer = 0;
  let dealsCount = 0;
  for (const deal of deals) {
    const totalFacture = deal.dealFactures.reduce(
      (sum, df) => sum + Number(df.montantHT),
      0,
    );
    const reste = Math.max(0, Number(deal.montantFinal) - totalFacture);
    if (reste > 0) {
      resteAFacturer += reste;
      dealsCount++;
    }
  }

  return { balance, pendingCount, pendingTotal, resteAFacturer, dealsCount, qontoError };
}

// ─── Temps de la semaine ────────────────────────────────────────────────────

export interface WeeklyTimeEntry {
  id: number;
  projectTitre: string;
  categorie: string;
  duree: number;
  unite: string;
}

export interface WeeklyTimeData {
  totalHeures: number;
  totalJours: number;
  entries: WeeklyTimeEntry[];
  projects: { id: number; titre: string }[];
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function getWeeklyTime(userId: number): Promise<WeeklyTimeData> {
  const currentWeek = isoWeek(new Date());

  const [entries, projects] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId, semaine: currentWeek },
      select: {
        id: true,
        duree: true,
        unite: true,
        categorie: true,
        project: { select: { titre: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: { statut: { in: ["en_cours", "en_attente"] }, isPersonnel: false },
      select: { id: true, titre: true },
      orderBy: { titre: "asc" },
    }),
  ]);

  let totalHeures = 0;
  for (const e of entries) {
    const d = Number(e.duree);
    totalHeures += e.unite === "jours" ? d * 8 : d;
  }

  return {
    totalHeures,
    totalJours: Math.round((totalHeures / 8) * 10) / 10,
    entries: entries.map((e) => ({
      id: e.id,
      projectTitre: e.project?.titre ?? "—",
      categorie: e.categorie,
      duree: Number(e.duree),
      unite: e.unite,
    })),
    projects,
  };
}
