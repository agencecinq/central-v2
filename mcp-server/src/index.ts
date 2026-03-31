#!/usr/bin/env node

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// Load .env.local from the parent Next.js project
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env.local");
config({ path: envPath });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getPrisma } from "./prisma.js";

const server = new McpServer({
  name: "CinqCentral",
  version: "1.0.0",
});

// ─── Helpers ─────────────────────────────────────────────

function dec(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

// ─── TOOLS ───────────────────────────────────────────────

// 1. List projects
server.tool(
  "list_projects",
  "Liste les projets avec filtrage optionnel par statut, client ou chef de projet",
  {
    statut: z.enum(["en_cours", "en_attente", "termine"]).optional().describe("Filtrer par statut"),
    clientId: z.number().optional().describe("Filtrer par ID client"),
    search: z.string().optional().describe("Recherche dans le titre"),
  },
  async ({ statut, clientId, search }) => {
    const prisma = getPrisma();
    const where: Record<string, unknown> = {};
    if (statut) where.statut = statut;
    if (clientId) where.clientId = clientId;
    if (search) where.titre = { contains: search, mode: "insensitive" };

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { entreprise: true, nom: true } },
        chefProjet: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const lines = projects.map((p) => {
      const client = p.client?.entreprise || p.client?.nom || "Sans client";
      const chef = p.chefProjet?.name || "—";
      return `[${p.id}] ${p.titre} | ${p.statut} | Client: ${client} | Chef: ${chef} | Budget: ${fmtCurrency(dec(p.budgetTotal))} | Tâches: ${p._count.tasks} | Début: ${fmtDate(p.dateDebut)} | Deadline: ${fmtDate(p.deadline)}`;
    });

    return { content: [{ type: "text", text: lines.length > 0 ? lines.join("\n") : "Aucun projet trouvé." }] };
  },
);

// 2. Get project detail
server.tool(
  "get_project",
  "Détail complet d'un projet : budget, tâches, phases, temps passé",
  {
    projectId: z.number().describe("ID du projet"),
  },
  async ({ projectId }) => {
    const prisma = getPrisma();
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        chefProjet: true,
        deal: { include: { dealFactures: true } },
        tasks: { include: { user: { select: { name: true } } }, orderBy: { statutKanban: "asc" } },
        allocations: { include: { metier: true, user: { select: { name: true } } } },
        transactions: { orderBy: { dateTransaction: "desc" }, take: 20 },
      },
    });

    if (!p) return { content: [{ type: "text", text: `Projet ${projectId} non trouvé.` }] };

    const tasksDone = p.tasks.filter((t) => t.statutKanban === "done").length;
    const budget = dec(p.budgetTotal);

    let text = `# ${p.titre}\n`;
    text += `Statut: ${p.statut} | Client: ${p.client?.entreprise || p.client?.nom || "—"} | Chef: ${p.chefProjet?.name || "—"}\n`;
    text += `Budget: ${fmtCurrency(budget)} | Début: ${fmtDate(p.dateDebut)} | Deadline: ${fmtDate(p.deadline)}\n`;
    text += `Tâches: ${tasksDone}/${p.tasks.length} terminées\n`;

    if (p.deal) {
      const montantSigne = dec(p.deal.montantFinal);
      const totalFacture = p.deal.dealFactures.reduce((s, f) => s + dec(f.montantHT), 0);
      text += `\nDeal: ${p.deal.titre} | Signé: ${fmtCurrency(montantSigne)} | Facturé: ${fmtCurrency(totalFacture)}\n`;
    }

    if (p.allocations.length > 0) {
      text += `\n## Phases/Allocations\n`;
      for (const a of p.allocations) {
        const assignee = a.user?.name || "Non assigné";
        text += `- ${a.metier.nom}: ${dec(a.joursPrevus)}j | ${assignee} | ${fmtDate(a.dateDebut)} → ${fmtDate(a.dateFin)}\n`;
      }
    }

    if (p.tasks.length > 0) {
      text += `\n## Tâches\n`;
      for (const t of p.tasks) {
        const assignee = t.user?.name || "—";
        text += `- [${t.statutKanban}] ${t.titre} | ${assignee} | Priorité: ${t.priorityLevel}\n`;
      }
    }

    return { content: [{ type: "text", text }] };
  },
);

// 3. Create task
server.tool(
  "create_task",
  "Créer une nouvelle tâche dans un projet",
  {
    projectId: z.number().describe("ID du projet"),
    titre: z.string().describe("Titre de la tâche"),
    description: z.string().optional().describe("Description de la tâche"),
    statutKanban: z.enum(["todo", "in_progress", "review", "done"]).optional().describe("Statut kanban"),
    priorityLevel: z.number().min(1).max(4).optional().describe("Priorité (1=basse, 4=urgente)"),
    userId: z.number().optional().describe("ID de l'utilisateur assigné"),
    categorie: z.string().optional().describe("Catégorie de la tâche"),
  },
  async ({ projectId, titre, description, statutKanban, priorityLevel, userId, categorie }) => {
    const prisma = getPrisma();
    const task = await prisma.task.create({
      data: {
        projectId,
        titre,
        description: description ?? null,
        statutKanban: statutKanban ?? "todo",
        priorityLevel: priorityLevel ?? 1,
        userId: userId ?? null,
        categorie: categorie ?? null,
      },
    });
    return { content: [{ type: "text", text: `Tâche créée : [${task.id}] ${task.titre} (${task.statutKanban})` }] };
  },
);

// 4. Update task
server.tool(
  "update_task",
  "Modifier une tâche existante (statut, titre, assignation, etc.)",
  {
    taskId: z.number().describe("ID de la tâche"),
    titre: z.string().optional(),
    description: z.string().optional(),
    statutKanban: z.enum(["todo", "in_progress", "review", "done"]).optional(),
    priorityLevel: z.number().min(1).max(4).optional(),
    userId: z.number().nullable().optional().describe("ID utilisateur (null pour désassigner)"),
  },
  async ({ taskId, ...updates }) => {
    const prisma = getPrisma();
    const data: Record<string, unknown> = {};
    if (updates.titre !== undefined) data.titre = updates.titre;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.statutKanban !== undefined) data.statutKanban = updates.statutKanban;
    if (updates.priorityLevel !== undefined) data.priorityLevel = updates.priorityLevel;
    if (updates.userId !== undefined) data.userId = updates.userId;

    const task = await prisma.task.update({ where: { id: taskId }, data });
    return { content: [{ type: "text", text: `Tâche [${task.id}] mise à jour : ${task.titre} (${task.statutKanban})` }] };
  },
);

// 5. List team members
server.tool(
  "list_team",
  "Liste les membres de l'équipe avec leurs métiers et TJM",
  {},
  async () => {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: { role: { in: ["admin", "equipe"] } },
      include: { userMetiers: { include: { metier: true } } },
      orderBy: { name: "asc" },
    });

    const lines = users.map((u) => {
      const metiers = u.userMetiers.map((um) => um.metier.nom).join(", ") || "—";
      return `[${u.id}] ${u.name} | ${u.role} | Métiers: ${metiers} | TJM: ${u.tjm ? `${dec(u.tjm)}€` : "—"}`;
    });

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// 6. Get person availability
server.tool(
  "get_availability",
  "Disponibilité par personne sur les 12 prochaines semaines (charge, dispo, projets)",
  {
    userId: z.number().optional().describe("Filtrer pour un utilisateur spécifique"),
  },
  async ({ userId }) => {
    const prisma = getPrisma();

    // Build 12 weeks
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const weeks: { start: Date; end: Date; key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const start = new Date(monday);
      start.setDate(start.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 4); // Friday
      const key = `${start.getFullYear()}-W${String(Math.ceil(((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`;
      const label = `${start.getDate()}/${start.getMonth() + 1}`;
      weeks.push({ start, end, key, label });
    }

    // Team members
    const teamWhere: Record<string, unknown> = { role: { in: ["admin", "equipe"] } };
    if (userId) teamWhere.id = userId;

    const teamUsers = await prisma.user.findMany({
      where: teamWhere,
      select: { id: true, name: true, userMetiers: { select: { metierId: true } } },
      orderBy: { name: "asc" },
    });

    // Métier → users map
    const metierToUsers = new Map<number, number[]>();
    for (const u of teamUsers) {
      for (const um of u.userMetiers) {
        const arr = metierToUsers.get(um.metierId) ?? [];
        arr.push(u.id);
        metierToUsers.set(um.metierId, arr);
      }
    }

    // Active allocations
    const allocations = await prisma.projectAllocation.findMany({
      where: { project: { statut: "en_cours" } },
      include: {
        project: { select: { id: true, titre: true, dateDebut: true, dateFin: true, deadline: true } },
        metier: { select: { id: true } },
      },
    });

    // Per-person charge
    type PersonWeek = { charge: number; projects: { titre: string; jours: number }[] };
    const personWeeks = new Map<number, Map<string, PersonWeek>>();

    for (const u of teamUsers) {
      const wmap = new Map<string, PersonWeek>();
      for (const w of weeks) wmap.set(w.key, { charge: 0, projects: [] });
      personWeeks.set(u.id, wmap);
    }

    for (const alloc of allocations) {
      const jours = dec(alloc.joursPrevus);
      if (jours <= 0) continue;

      const dateDebut = alloc.dateDebut ?? alloc.project.dateDebut;
      const dateFin = alloc.dateFin ?? alloc.project.dateFin ?? alloc.project.deadline;

      // Find overlapping weeks
      const overlapping = weeks.filter((w) => {
        if (dateDebut && w.end < dateDebut) return false;
        if (dateFin && w.start > dateFin) return false;
        return true;
      });

      if (overlapping.length === 0) continue;
      const joursPerWeek = jours / overlapping.length;

      const targetUsers: number[] = [];
      if (alloc.userId) {
        if (personWeeks.has(alloc.userId)) targetUsers.push(alloc.userId);
      } else {
        const metierUsers = metierToUsers.get(alloc.metier.id) ?? [];
        for (const uid of metierUsers) {
          if (personWeeks.has(uid)) targetUsers.push(uid);
        }
      }

      if (targetUsers.length === 0) continue;
      const share = alloc.userId ? joursPerWeek : joursPerWeek / targetUsers.length;

      for (const uid of targetUsers) {
        const wmap = personWeeks.get(uid)!;
        for (const w of overlapping) {
          const wd = wmap.get(w.key)!;
          wd.charge += share;
          const existing = wd.projects.find((p) => p.titre === alloc.project.titre);
          if (existing) existing.jours += share;
          else wd.projects.push({ titre: alloc.project.titre, jours: share });
        }
      }
    }

    // Format output
    let text = `# Disponibilité équipe — 12 semaines\n\n`;
    text += `Semaines: ${weeks.map((w) => w.label).join(" | ")}\n\n`;

    for (const u of teamUsers) {
      const wmap = personWeeks.get(u.id)!;
      text += `## ${u.name}\n`;

      const weekLines: string[] = [];
      for (const w of weeks) {
        const wd = wmap.get(w.key)!;
        const charge = Math.round(wd.charge * 10) / 10;
        const dispo = Math.round((5 - charge) * 10) / 10;
        const status = dispo > 2.5 ? "🟢" : dispo > 0 ? "🟡" : "🔴";
        const projs = wd.projects.map((p) => `${p.titre}(${Math.round(p.jours * 10) / 10}j)`).join(", ");
        weekLines.push(`${w.label}: ${status} charge=${charge}j dispo=${dispo}j${projs ? ` [${projs}]` : ""}`);
      }
      text += weekLines.join("\n") + "\n\n";
    }

    return { content: [{ type: "text", text }] };
  },
);

// 7. List deals (CRM pipeline)
server.tool(
  "list_deals",
  "Liste les deals du CRM avec filtrage par étape",
  {
    etape: z.string().optional().describe("Filtrer par étape (Prospect, Proposition, Négociation, Gagné, Perdu)"),
    clientId: z.number().optional().describe("Filtrer par client"),
  },
  async ({ etape, clientId }) => {
    const prisma = getPrisma();
    const where: Record<string, unknown> = {};
    if (etape) where.etape = etape;
    if (clientId) where.clientId = clientId;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        client: { select: { entreprise: true, nom: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const lines = deals.map((d) => {
      const client = d.client.entreprise || d.client.nom;
      return `[${d.id}] ${d.titre} | ${d.etape} | Client: ${client} | Estimé: ${fmtCurrency(dec(d.montantEstime))} | Signé: ${d.montantFinal ? fmtCurrency(dec(d.montantFinal)) : "—"} | Projets: ${d._count.projects}`;
    });

    return { content: [{ type: "text", text: lines.length > 0 ? lines.join("\n") : "Aucun deal trouvé." }] };
  },
);

// 8. List clients
server.tool(
  "list_clients",
  "Liste les clients de l'agence",
  {
    search: z.string().optional().describe("Recherche dans le nom ou l'entreprise"),
  },
  async ({ search }) => {
    const prisma = getPrisma();
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: "insensitive" } },
        { entreprise: { contains: search, mode: "insensitive" } },
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: { _count: { select: { projects: true, deals: true } } },
      orderBy: { entreprise: "asc" },
    });

    const lines = clients.map((c) => {
      return `[${c.id}] ${c.entreprise || c.nom} | ${c.statut} | Email: ${c.email} | Projets: ${c._count.projects} | Deals: ${c._count.deals}`;
    });

    return { content: [{ type: "text", text: lines.length > 0 ? lines.join("\n") : "Aucun client trouvé." }] };
  },
);

// 9. Finance summary
server.tool(
  "get_finance_summary",
  "Résumé financier : total signé, facturé, dépenses, budget par projet",
  {
    year: z.number().optional().describe("Année (défaut: année en cours)"),
  },
  async ({ year }) => {
    const prisma = getPrisma();
    const y = year ?? new Date().getFullYear();

    // Deals signés cette année
    const signedDeals = await prisma.deal.findMany({
      where: {
        etape: "Gagné",
        dateSignature: { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) },
      },
      include: { client: { select: { entreprise: true, nom: true } }, dealFactures: true },
    });

    const totalSigne = signedDeals.reduce((s, d) => s + dec(d.montantFinal), 0);
    const totalFacture = signedDeals.reduce(
      (s, d) => s + d.dealFactures.reduce((sf, f) => sf + dec(f.montantHT), 0),
      0,
    );

    // Active projects
    const activeProjects = await prisma.project.findMany({
      where: { statut: "en_cours" },
      select: { id: true, titre: true, budgetTotal: true, budgetConsomme: true },
    });

    let text = `# Résumé financier ${y}\n\n`;
    text += `Total signé: ${fmtCurrency(totalSigne)}\n`;
    text += `Total facturé: ${fmtCurrency(totalFacture)}\n`;
    text += `Reste à facturer: ${fmtCurrency(totalSigne - totalFacture)}\n\n`;

    text += `## Deals signés (${signedDeals.length})\n`;
    for (const d of signedDeals) {
      const client = d.client.entreprise || d.client.nom;
      const facture = d.dealFactures.reduce((s, f) => s + dec(f.montantHT), 0);
      text += `- ${d.titre} (${client}): ${fmtCurrency(dec(d.montantFinal))} | Facturé: ${fmtCurrency(facture)}\n`;
    }

    text += `\n## Projets actifs (${activeProjects.length})\n`;
    for (const p of activeProjects) {
      text += `- [${p.id}] ${p.titre}: Budget ${fmtCurrency(dec(p.budgetTotal))}\n`;
    }

    return { content: [{ type: "text", text }] };
  },
);

// 10. Search across entities
server.tool(
  "search",
  "Recherche transversale dans les projets, tâches, deals et clients",
  {
    query: z.string().describe("Terme de recherche"),
  },
  async ({ query }) => {
    const prisma = getPrisma();
    const q = { contains: query, mode: "insensitive" as const };

    const [projects, tasks, deals, clients] = await Promise.all([
      prisma.project.findMany({
        where: { OR: [{ titre: q }, { description: q }] },
        select: { id: true, titre: true, statut: true },
        take: 10,
      }),
      prisma.task.findMany({
        where: { OR: [{ titre: q }, { description: q }] },
        select: { id: true, titre: true, statutKanban: true, projectId: true },
        take: 10,
      }),
      prisma.deal.findMany({
        where: { titre: q },
        select: { id: true, titre: true, etape: true },
        take: 10,
      }),
      prisma.client.findMany({
        where: { OR: [{ nom: q }, { entreprise: q }] },
        select: { id: true, nom: true, entreprise: true },
        take: 10,
      }),
    ]);

    let text = `# Résultats pour "${query}"\n\n`;

    if (projects.length > 0) {
      text += `## Projets\n`;
      for (const p of projects) text += `- [${p.id}] ${p.titre} (${p.statut})\n`;
    }
    if (tasks.length > 0) {
      text += `## Tâches\n`;
      for (const t of tasks) text += `- [${t.id}] ${t.titre} (${t.statutKanban}) — projet ${t.projectId}\n`;
    }
    if (deals.length > 0) {
      text += `## Deals\n`;
      for (const d of deals) text += `- [${d.id}] ${d.titre} (${d.etape})\n`;
    }
    if (clients.length > 0) {
      text += `## Clients\n`;
      for (const c of clients) text += `- [${c.id}] ${c.entreprise || c.nom}\n`;
    }

    if (projects.length + tasks.length + deals.length + clients.length === 0) {
      text += "Aucun résultat.\n";
    }

    return { content: [{ type: "text", text }] };
  },
);

// 11. Log time entry
server.tool(
  "log_time",
  "Saisir du temps passé sur un projet",
  {
    userId: z.number().describe("ID de l'utilisateur"),
    projectId: z.number().describe("ID du projet"),
    semaine: z.string().describe("Semaine au format YYYY-MM-DD (lundi)"),
    duree: z.number().describe("Durée en heures"),
    categorie: z.string().describe("Catégorie (ex: dev, design, gestion)"),
    description: z.string().optional().describe("Description du travail"),
    taskId: z.number().optional().describe("ID de la tâche liée"),
  },
  async ({ userId, projectId, semaine, duree, categorie, description, taskId }) => {
    const prisma = getPrisma();
    const entry = await prisma.timeEntry.create({
      data: {
        userId,
        projectId,
        semaine,
        duree,
        categorie,
        description: description ?? null,
        taskId: taskId ?? null,
      },
    });
    return { content: [{ type: "text", text: `Temps saisi : ${duree}h sur projet ${projectId} (${categorie}) — ID ${entry.id}` }] };
  },
);

// 12. Get time entries
server.tool(
  "get_time_entries",
  "Consulter le temps passé par projet ou par personne",
  {
    projectId: z.number().optional().describe("Filtrer par projet"),
    userId: z.number().optional().describe("Filtrer par utilisateur"),
    limit: z.number().optional().describe("Nombre d'entrées (défaut: 50)"),
  },
  async ({ projectId, userId, limit }) => {
    const prisma = getPrisma();
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (userId) where.userId = userId;

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { name: true } },
        project: { select: { titre: true } },
        task: { select: { titre: true } },
      },
      orderBy: { semaine: "desc" },
      take: limit ?? 50,
    });

    if (entries.length === 0) return { content: [{ type: "text", text: "Aucune saisie de temps trouvée." }] };

    // Group by week
    const byWeek = new Map<string, typeof entries>();
    for (const e of entries) {
      const arr = byWeek.get(e.semaine) ?? [];
      arr.push(e);
      byWeek.set(e.semaine, arr);
    }

    let text = "";
    for (const [week, wEntries] of [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
      const total = wEntries.reduce((s, e) => s + dec(e.duree), 0);
      text += `## Semaine ${week} (${total}h)\n`;
      for (const e of wEntries) {
        text += `- ${e.user.name} | ${e.project?.titre ?? "—"} | ${dec(e.duree)}h | ${e.categorie}${e.task ? ` | Tâche: ${e.task.titre}` : ""}${e.description ? ` | ${e.description}` : ""}\n`;
      }
      text += "\n";
    }

    return { content: [{ type: "text", text }] };
  },
);

// ─── Start ───────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CinqCentral MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
