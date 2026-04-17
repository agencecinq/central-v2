import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function dec(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "CinqCentral",
    version: "1.0.0",
  });

  // 1. List projects
  server.tool(
    "list_projects",
    "Liste les projets avec filtrage optionnel par statut, client ou recherche",
    {
      statut: z
        .enum(["en_cours", "en_attente", "termine"])
        .optional()
        .describe("Filtrer par statut"),
      clientId: z.number().optional().describe("Filtrer par ID client"),
      search: z.string().optional().describe("Recherche dans le titre"),
    },
    async ({ statut, clientId, search }) => {
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

      const lines = projects.map(
        (p: {
          id: number;
          titre: string;
          statut: string;
          budgetTotal: unknown;
          dateDebut: Date | null;
          deadline: Date | null;
          client: { entreprise: string | null; nom: string } | null;
          chefProjet: { name: string } | null;
          _count: { tasks: number };
        }) => {
          const client =
            p.client?.entreprise || p.client?.nom || "Sans client";
          const chef = p.chefProjet?.name || "—";
          return `[${p.id}] ${p.titre} | ${p.statut} | Client: ${client} | Chef: ${chef} | Budget: ${fmtCurrency(dec(p.budgetTotal))} | Tâches: ${p._count.tasks} | Début: ${fmtDate(p.dateDebut)} | Deadline: ${fmtDate(p.deadline)}`;
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: lines.length > 0 ? lines.join("\n") : "Aucun projet trouvé.",
          },
        ],
      };
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
      const p = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          client: true,
          chefProjet: true,
          deal: { include: { dealFactures: true } },
          tasks: {
            include: { user: { select: { name: true } } },
            orderBy: { statutKanban: "asc" },
          },
          allocations: {
            include: { metier: true, user: { select: { name: true } } },
          },
        },
      });

      if (!p)
        return {
          content: [
            { type: "text" as const, text: `Projet ${projectId} non trouvé.` },
          ],
        };

      const tasksDone = p.tasks.filter(
        (t: { statutKanban: string }) => t.statutKanban === "done",
      ).length;
      const budget = dec(p.budgetTotal);

      let text = `# ${p.titre}\n`;
      text += `Statut: ${p.statut} | Client: ${p.client?.entreprise || p.client?.nom || "—"} | Chef: ${p.chefProjet?.name || "—"}\n`;
      text += `Budget: ${fmtCurrency(budget)} | Début: ${fmtDate(p.dateDebut)} | Deadline: ${fmtDate(p.deadline)}\n`;
      text += `Tâches: ${tasksDone}/${p.tasks.length} terminées\n`;

      if (p.deal) {
        const montantSigne = dec(p.deal.montantFinal);
        const totalFacture = p.deal.dealFactures.reduce(
          (s: number, f: { montantHT: unknown }) => s + dec(f.montantHT),
          0,
        );
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

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 2b. Update project
  server.tool(
    "update_project",
    "Modifier un projet (statut, titre, description, dates, budget, chef de projet, etc.)",
    {
      projectId: z.number().describe("ID du projet"),
      titre: z.string().optional(),
      description: z.string().optional(),
      statut: z
        .enum(["en_cours", "en_attente", "termine"])
        .optional()
        .describe("Statut du projet"),
      dateDebut: z
        .string()
        .optional()
        .describe("Date de début (YYYY-MM-DD)"),
      dateFin: z.string().optional().describe("Date de fin (YYYY-MM-DD)"),
      deadline: z.string().optional().describe("Deadline (YYYY-MM-DD)"),
      budgetTotal: z.number().optional().describe("Budget total en €"),
      chefProjetId: z
        .number()
        .nullable()
        .optional()
        .describe("ID du chef de projet (null pour retirer)"),
      githubUrl: z.string().optional(),
      figmaUrl: z.string().optional(),
    },
    async ({ projectId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.titre !== undefined) data.titre = updates.titre;
      if (updates.description !== undefined)
        data.description = updates.description;
      if (updates.statut !== undefined) data.statut = updates.statut;
      if (updates.dateDebut !== undefined)
        data.dateDebut = new Date(updates.dateDebut);
      if (updates.dateFin !== undefined)
        data.dateFin = new Date(updates.dateFin);
      if (updates.deadline !== undefined)
        data.deadline = new Date(updates.deadline);
      if (updates.budgetTotal !== undefined)
        data.budgetTotal = updates.budgetTotal;
      if (updates.chefProjetId !== undefined)
        data.chefProjetId = updates.chefProjetId;
      if (updates.githubUrl !== undefined) data.githubUrl = updates.githubUrl;
      if (updates.figmaUrl !== undefined) data.figmaUrl = updates.figmaUrl;

      const project = await prisma.project.update({
        where: { id: projectId },
        data,
        include: { client: { select: { entreprise: true, nom: true } } },
      });

      const client =
        project.client?.entreprise || project.client?.nom || "—";
      return {
        content: [
          {
            type: "text" as const,
            text: `Projet [${project.id}] mis à jour : ${project.titre} | ${project.statut} | Client: ${client}`,
          },
        ],
      };
    },
  );

  // 3. Create task
  server.tool(
    "create_task",
    "Créer une nouvelle tâche dans un projet",
    {
      projectId: z.number().describe("ID du projet"),
      titre: z.string().describe("Titre de la tâche"),
      description: z.string().optional().describe("Description"),
      statutKanban: z
        .enum(["todo", "in_progress", "review", "done"])
        .optional()
        .describe("Statut kanban"),
      priorityLevel: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe("Priorité (1=basse, 4=urgente)"),
      userId: z.number().optional().describe("ID utilisateur assigné"),
      categorie: z.string().optional().describe("Catégorie"),
    },
    async ({
      projectId,
      titre,
      description,
      statutKanban,
      priorityLevel,
      userId,
      categorie,
    }) => {
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
      return {
        content: [
          {
            type: "text" as const,
            text: `Tâche créée : [${task.id}] ${task.titre} (${task.statutKanban})`,
          },
        ],
      };
    },
  );

  // 4. Update task
  server.tool(
    "update_task",
    "Modifier une tâche (statut, titre, assignation, etc.)",
    {
      taskId: z.number().describe("ID de la tâche"),
      titre: z.string().optional(),
      description: z.string().optional(),
      statutKanban: z
        .enum(["todo", "in_progress", "review", "done"])
        .optional(),
      priorityLevel: z.number().min(1).max(4).optional(),
      userId: z
        .number()
        .nullable()
        .optional()
        .describe("ID utilisateur (null pour désassigner)"),
    },
    async ({ taskId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.titre !== undefined) data.titre = updates.titre;
      if (updates.description !== undefined)
        data.description = updates.description;
      if (updates.statutKanban !== undefined)
        data.statutKanban = updates.statutKanban;
      if (updates.priorityLevel !== undefined)
        data.priorityLevel = updates.priorityLevel;
      if (updates.userId !== undefined) data.userId = updates.userId;

      const task = await prisma.task.update({ where: { id: taskId }, data });
      return {
        content: [
          {
            type: "text" as const,
            text: `Tâche [${task.id}] mise à jour : ${task.titre} (${task.statutKanban})`,
          },
        ],
      };
    },
  );

  // 5. List team
  server.tool(
    "list_team",
    "Liste les membres de l'équipe avec leurs métiers et TJM",
    {},
    async () => {
      const users = await prisma.user.findMany({
        where: { role: { in: ["admin", "equipe"] } },
        include: { userMetiers: { include: { metier: true } } },
        orderBy: { name: "asc" },
      });

      const lines = users.map(
        (u: {
          id: number;
          name: string;
          role: string;
          tjm: unknown;
          userMetiers: { metier: { nom: string } }[];
        }) => {
          const metiers =
            u.userMetiers.map((um) => um.metier.nom).join(", ") || "—";
          return `[${u.id}] ${u.name} | ${u.role} | Métiers: ${metiers} | TJM: ${u.tjm ? `${dec(u.tjm)}€` : "—"}`;
        },
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );

  // 6. Get person availability
  server.tool(
    "get_availability",
    "Disponibilité par personne sur les 12 prochaines semaines",
    {
      userId: z.number().optional().describe("Filtrer pour un utilisateur"),
    },
    async ({ userId }) => {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const weeks: { start: Date; end: Date; label: string }[] = [];
      for (let i = 0; i < 12; i++) {
        const start = new Date(monday);
        start.setDate(start.getDate() + i * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 4);
        weeks.push({
          start,
          end,
          label: `${start.getDate()}/${start.getMonth() + 1}`,
        });
      }

      const teamWhere: Record<string, unknown> = {
        role: { in: ["admin", "equipe"] },
      };
      if (userId) teamWhere.id = userId;

      const teamUsers = await prisma.user.findMany({
        where: teamWhere,
        select: {
          id: true,
          name: true,
          userMetiers: { select: { metierId: true } },
        },
        orderBy: { name: "asc" },
      });

      const metierToUsers = new Map<number, number[]>();
      for (const u of teamUsers) {
        for (const um of u.userMetiers) {
          const arr = metierToUsers.get(um.metierId) ?? [];
          arr.push(u.id);
          metierToUsers.set(um.metierId, arr);
        }
      }

      const allocations = await prisma.projectAllocation.findMany({
        where: { project: { statut: "en_cours" } },
        include: {
          project: {
            select: {
              titre: true,
              dateDebut: true,
              dateFin: true,
              deadline: true,
            },
          },
          metier: { select: { id: true } },
        },
      });

      type PersonWeek = {
        charge: number;
        projects: { titre: string; jours: number }[];
      };
      const personWeeks = new Map<number, Map<number, PersonWeek>>();
      for (const u of teamUsers) {
        const wmap = new Map<number, PersonWeek>();
        for (let i = 0; i < weeks.length; i++)
          wmap.set(i, { charge: 0, projects: [] });
        personWeeks.set(u.id, wmap);
      }

      for (const alloc of allocations) {
        const jours = dec(alloc.joursPrevus);
        if (jours <= 0) continue;
        const dateDebut = alloc.dateDebut ?? alloc.project.dateDebut;
        const dateFin =
          alloc.dateFin ?? alloc.project.dateFin ?? alloc.project.deadline;

        const overlapping = weeks
          .map((w, i) => ({ ...w, i }))
          .filter((w) => {
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
        const share = alloc.userId
          ? joursPerWeek
          : joursPerWeek / targetUsers.length;

        for (const uid of targetUsers) {
          const wmap = personWeeks.get(uid)!;
          for (const w of overlapping) {
            const wd = wmap.get(w.i)!;
            wd.charge += share;
            const existing = wd.projects.find(
              (p) => p.titre === alloc.project.titre,
            );
            if (existing) existing.jours += share;
            else wd.projects.push({ titre: alloc.project.titre, jours: share });
          }
        }
      }

      let text = `# Disponibilité équipe — 12 semaines\n\n`;
      for (const u of teamUsers) {
        const wmap = personWeeks.get(u.id)!;
        text += `## ${u.name}\n`;
        for (let i = 0; i < weeks.length; i++) {
          const w = weeks[i];
          const wd = wmap.get(i)!;
          const charge = Math.round(wd.charge * 10) / 10;
          const dispo = Math.round((5 - charge) * 10) / 10;
          const projs = wd.projects
            .map(
              (p) =>
                `${p.titre}(${Math.round(p.jours * 10) / 10}j)`,
            )
            .join(", ");
          text += `${w.label}: charge=${charge}j dispo=${dispo}j${projs ? ` [${projs}]` : ""}\n`;
        }
        text += "\n";
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 7. List deals
  server.tool(
    "list_deals",
    "Liste les deals du CRM avec filtrage par étape",
    {
      etape: z.string().optional().describe("Filtrer par étape"),
      clientId: z.number().optional().describe("Filtrer par client"),
    },
    async ({ etape, clientId }) => {
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

      const lines = deals.map(
        (d: {
          id: number;
          titre: string;
          etape: string;
          montantEstime: unknown;
          montantFinal: unknown;
          client: { entreprise: string | null; nom: string };
          _count: { projects: number };
        }) => {
          const client = d.client.entreprise || d.client.nom;
          return `[${d.id}] ${d.titre} | ${d.etape} | Client: ${client} | Estimé: ${fmtCurrency(dec(d.montantEstime))} | Signé: ${d.montantFinal ? fmtCurrency(dec(d.montantFinal)) : "—"} | Projets: ${d._count.projects}`;
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: lines.length > 0 ? lines.join("\n") : "Aucun deal trouvé.",
          },
        ],
      };
    },
  );

  // 8. List clients
  server.tool(
    "list_clients",
    "Liste les clients de l'agence",
    {
      search: z
        .string()
        .optional()
        .describe("Recherche dans nom ou entreprise"),
    },
    async ({ search }) => {
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

      const lines = clients.map(
        (c: {
          id: number;
          nom: string;
          entreprise: string | null;
          statut: string;
          email: string;
          _count: { projects: number; deals: number };
        }) => {
          return `[${c.id}] ${c.entreprise || c.nom} | ${c.statut} | Email: ${c.email} | Projets: ${c._count.projects} | Deals: ${c._count.deals}`;
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text:
              lines.length > 0 ? lines.join("\n") : "Aucun client trouvé.",
          },
        ],
      };
    },
  );

  // 9. Finance summary
  server.tool(
    "get_finance_summary",
    "Résumé financier : total signé, facturé, dépenses par année",
    {
      year: z
        .number()
        .optional()
        .describe("Année (défaut: année en cours)"),
    },
    async ({ year }) => {
      const y = year ?? new Date().getFullYear();

      const signedDeals = await prisma.deal.findMany({
        where: {
          etape: "Gagné",
          dateSignature: {
            gte: new Date(`${y}-01-01`),
            lt: new Date(`${y + 1}-01-01`),
          },
        },
        include: {
          client: { select: { entreprise: true, nom: true } },
          dealFactures: true,
        },
      });

      const totalSigne = signedDeals.reduce(
        (s: number, d: { montantFinal: unknown }) => s + dec(d.montantFinal),
        0,
      );
      const totalFacture = signedDeals.reduce(
        (s: number, d: { dealFactures: { montantHT: unknown }[] }) =>
          s +
          d.dealFactures.reduce(
            (sf: number, f: { montantHT: unknown }) => sf + dec(f.montantHT),
            0,
          ),
        0,
      );

      const activeProjects = await prisma.project.findMany({
        where: { statut: "en_cours" },
        select: { id: true, titre: true, budgetTotal: true },
      });

      let text = `# Résumé financier ${y}\n\n`;
      text += `Total signé: ${fmtCurrency(totalSigne)}\n`;
      text += `Total facturé: ${fmtCurrency(totalFacture)}\n`;
      text += `Reste à facturer: ${fmtCurrency(totalSigne - totalFacture)}\n\n`;

      text += `## Deals signés (${signedDeals.length})\n`;
      for (const d of signedDeals) {
        const client = d.client.entreprise || d.client.nom;
        const facture = d.dealFactures.reduce(
          (s: number, f: { montantHT: unknown }) => s + dec(f.montantHT),
          0,
        );
        text += `- ${d.titre} (${client}): ${fmtCurrency(dec(d.montantFinal))} | Facturé: ${fmtCurrency(facture)}\n`;
      }

      text += `\n## Projets actifs (${activeProjects.length})\n`;
      for (const p of activeProjects) {
        text += `- [${p.id}] ${p.titre}: Budget ${fmtCurrency(dec(p.budgetTotal))}\n`;
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 10. Search
  server.tool(
    "search",
    "Recherche transversale (projets, tâches, deals, clients)",
    {
      query: z.string().describe("Terme de recherche"),
    },
    async ({ query }) => {
      const q = { contains: query, mode: "insensitive" as const };

      const [projects, tasks, deals, clients] = await Promise.all([
        prisma.project.findMany({
          where: { OR: [{ titre: q }, { description: q }] },
          select: { id: true, titre: true, statut: true },
          take: 10,
        }),
        prisma.task.findMany({
          where: { OR: [{ titre: q }, { description: q }] },
          select: {
            id: true,
            titre: true,
            statutKanban: true,
            projectId: true,
          },
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
        for (const p of projects)
          text += `- [${p.id}] ${p.titre} (${p.statut})\n`;
      }
      if (tasks.length > 0) {
        text += `## Tâches\n`;
        for (const t of tasks)
          text += `- [${t.id}] ${t.titre} (${t.statutKanban}) — projet ${t.projectId}\n`;
      }
      if (deals.length > 0) {
        text += `## Deals\n`;
        for (const d of deals)
          text += `- [${d.id}] ${d.titre} (${d.etape})\n`;
      }
      if (clients.length > 0) {
        text += `## Clients\n`;
        for (const c of clients)
          text += `- [${c.id}] ${c.entreprise || c.nom}\n`;
      }
      if (
        projects.length + tasks.length + deals.length + clients.length ===
        0
      ) {
        text += "Aucun résultat.\n";
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 11. Log time
  server.tool(
    "log_time",
    "Saisir du temps passé sur un projet",
    {
      userId: z.number().describe("ID de l'utilisateur"),
      projectId: z.number().describe("ID du projet"),
      semaine: z.string().describe("Semaine au format YYYY-MM-DD (lundi)"),
      duree: z.number().describe("Durée en heures"),
      categorie: z.string().describe("Catégorie (ex: dev, design, gestion)"),
      description: z.string().optional(),
      taskId: z.number().optional(),
    },
    async ({
      userId,
      projectId,
      semaine,
      duree,
      categorie,
      description,
      taskId,
    }) => {
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
      return {
        content: [
          {
            type: "text" as const,
            text: `Temps saisi : ${duree}h sur projet ${projectId} (${categorie}) — ID ${entry.id}`,
          },
        ],
      };
    },
  );

  // 12. Get time entries
  server.tool(
    "get_time_entries",
    "Consulter le temps passé par projet ou par personne",
    {
      projectId: z.number().optional(),
      userId: z.number().optional(),
      limit: z.number().optional().describe("Nombre d'entrées (défaut: 50)"),
    },
    async ({ projectId, userId, limit }) => {
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

      if (entries.length === 0)
        return {
          content: [
            {
              type: "text" as const,
              text: "Aucune saisie de temps trouvée.",
            },
          ],
        };

      const byWeek = new Map<string, typeof entries>();
      for (const e of entries) {
        const arr = byWeek.get(e.semaine) ?? [];
        arr.push(e);
        byWeek.set(e.semaine, arr);
      }

      let text = "";
      for (const [week, wEntries] of [...byWeek.entries()].sort((a, b) =>
        b[0].localeCompare(a[0]),
      )) {
        const total = wEntries.reduce(
          (s: number, e: { duree: unknown }) => s + dec(e.duree),
          0,
        );
        text += `## Semaine ${week} (${total}h)\n`;
        for (const e of wEntries) {
          text += `- ${e.user.name} | ${e.project?.titre ?? "—"} | ${dec(e.duree)}h | ${e.categorie}${e.task ? ` | Tâche: ${e.task.titre}` : ""}${e.description ? ` | ${e.description}` : ""}\n`;
        }
        text += "\n";
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 13. List tickets
  server.tool(
    "list_tickets",
    "Liste les tickets/bugs d'un projet avec filtrage par statut",
    {
      projectId: z.number().optional().describe("Filtrer par projet"),
      statut: z
        .enum(["ouvert", "en_cours", "resolu", "ferme"])
        .optional()
        .describe("Filtrer par statut"),
      assigneId: z.number().optional().describe("Filtrer par assigné"),
    },
    async ({ projectId, statut, assigneId }) => {
      const where: Record<string, unknown> = {};
      if (projectId) where.projectId = projectId;
      if (statut) where.statut = statut;
      if (assigneId) where.assigneId = assigneId;

      const tickets = await prisma.ticket.findMany({
        where,
        include: {
          project: { select: { titre: true } },
          createur: { select: { name: true } },
          assigne: { select: { name: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const lines = tickets.map(
        (t: {
          id: number;
          titre: string;
          statut: string;
          project: { titre: string };
          createur: { name: string } | null;
          assigne: { name: string } | null;
          _count: { comments: number };
          createdAt: Date | null;
        }) => {
          return `[${t.id}] ${t.titre} | ${t.statut} | Projet: ${t.project.titre} | Créé par: ${t.createur?.name || "—"} | Assigné: ${t.assigne?.name || "—"} | ${t._count.comments} commentaires | ${fmtDate(t.createdAt)}`;
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: lines.length > 0 ? lines.join("\n") : "Aucun ticket trouvé.",
          },
        ],
      };
    },
  );

  // 14. Get ticket detail
  server.tool(
    "get_ticket",
    "Détail d'un ticket avec ses commentaires",
    {
      ticketId: z.number().describe("ID du ticket"),
    },
    async ({ ticketId }) => {
      const t = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          project: { select: { titre: true } },
          createur: { select: { name: true } },
          assigne: { select: { name: true } },
          comments: {
            include: { auteur: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
          attachments: { select: { filename: true, mimetype: true } },
        },
      });

      if (!t)
        return {
          content: [
            { type: "text" as const, text: `Ticket ${ticketId} non trouvé.` },
          ],
        };

      let text = `# Ticket [${t.id}] ${t.titre}\n`;
      text += `Statut: ${t.statut} | Projet: ${t.project.titre}\n`;
      text += `Créé par: ${t.createur?.name || "—"} | Assigné: ${t.assigne?.name || "—"}\n`;
      text += `Date: ${fmtDate(t.createdAt)}\n`;
      if (t.description) text += `\n${t.description}\n`;
      if (t.navigateur || t.tailleEcran) {
        text += `\nMeta: ${t.navigateur || ""} ${t.tailleEcran || ""}\n`;
      }
      if (t.attachments.length > 0) {
        text += `\n## Pièces jointes (${t.attachments.length})\n`;
        for (const a of t.attachments) text += `- ${a.filename} (${a.mimetype})\n`;
      }
      if (t.comments.length > 0) {
        text += `\n## Commentaires (${t.comments.length})\n`;
        for (const c of t.comments) {
          text += `- ${c.auteur.name} (${fmtDate(c.createdAt)}): ${c.contenu}\n`;
        }
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 15. Create ticket
  server.tool(
    "create_ticket",
    "Créer un nouveau ticket/bug dans un projet",
    {
      projectId: z.number().describe("ID du projet"),
      titre: z.string().describe("Titre du ticket"),
      description: z.string().optional().describe("Description du bug/ticket"),
      createurId: z.number().optional().describe("ID du créateur"),
      assigneId: z.number().optional().describe("ID de la personne assignée"),
    },
    async ({ projectId, titre, description, createurId, assigneId }) => {
      const ticket = await prisma.ticket.create({
        data: {
          projectId,
          titre,
          description: description ?? null,
          createurId: createurId ?? null,
          assigneId: assigneId ?? null,
        },
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Ticket créé : [${ticket.id}] ${ticket.titre} (${ticket.statut})`,
          },
        ],
      };
    },
  );

  // 16. Update ticket
  server.tool(
    "update_ticket",
    "Modifier un ticket (statut, assignation, titre, etc.)",
    {
      ticketId: z.number().describe("ID du ticket"),
      titre: z.string().optional(),
      description: z.string().optional(),
      statut: z
        .enum(["ouvert", "en_cours", "resolu", "ferme"])
        .optional()
        .describe("Nouveau statut"),
      assigneId: z
        .number()
        .nullable()
        .optional()
        .describe("ID assigné (null pour désassigner)"),
    },
    async ({ ticketId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.titre !== undefined) data.titre = updates.titre;
      if (updates.description !== undefined)
        data.description = updates.description;
      if (updates.statut !== undefined) data.statut = updates.statut;
      if (updates.assigneId !== undefined) data.assigneId = updates.assigneId;

      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Ticket [${ticket.id}] mis à jour : ${ticket.titre} (${ticket.statut})`,
          },
        ],
      };
    },
  );

  // 17. Add comment to ticket
  server.tool(
    "add_ticket_comment",
    "Ajouter un commentaire à un ticket",
    {
      ticketId: z.number().describe("ID du ticket"),
      auteurId: z.number().describe("ID de l'auteur du commentaire"),
      contenu: z.string().describe("Contenu du commentaire"),
    },
    async ({ ticketId, auteurId, contenu }) => {
      const comment = await prisma.ticketComment.create({
        data: { ticketId, auteurId, contenu },
        include: { auteur: { select: { name: true } } },
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Commentaire ajouté par ${comment.auteur.name} sur le ticket ${ticketId}`,
          },
        ],
      };
    },
  );

  // 18. Create deal
  server.tool(
    "create_deal",
    "Créer un nouveau deal dans le CRM",
    {
      clientId: z.number().describe("ID du client associé au deal"),
      titre: z.string().describe("Titre du deal"),
      montantEstime: z.number().describe("Montant estimé en €"),
      etape: z
        .string()
        .optional()
        .describe(
          "Étape du deal (ex: Prospect, Qualifié, Proposition, Négociation, Gagné, Perdu). Défaut: Prospect",
        ),
      montantFinal: z
        .number()
        .optional()
        .describe("Montant final signé en €"),
      modalitesFacturation: z
        .string()
        .optional()
        .describe("Modalités de facturation"),
      dateSignature: z
        .string()
        .optional()
        .describe("Date de signature (YYYY-MM-DD)"),
    },
    async ({
      clientId,
      titre,
      montantEstime,
      etape,
      montantFinal,
      modalitesFacturation,
      dateSignature,
    }) => {
      const deal = await prisma.deal.create({
        data: {
          clientId,
          titre,
          montantEstime,
          etape: etape ?? "Prospect",
          montantFinal: montantFinal ?? null,
          modalitesFacturation: modalitesFacturation ?? null,
          dateSignature: dateSignature ? new Date(dateSignature) : null,
        },
        include: { client: { select: { entreprise: true, nom: true } } },
      });
      const client = deal.client.entreprise || deal.client.nom;
      return {
        content: [
          {
            type: "text" as const,
            text: `Deal créé : [${deal.id}] ${deal.titre} | ${deal.etape} | Client: ${client} | Estimé: ${fmtCurrency(dec(deal.montantEstime))}`,
          },
        ],
      };
    },
  );

  // 19. Update deal
  server.tool(
    "update_deal",
    "Modifier un deal (étape, montants, dates, etc.)",
    {
      dealId: z.number().describe("ID du deal"),
      titre: z.string().optional(),
      etape: z
        .string()
        .optional()
        .describe("Nouvelle étape (Prospect, Qualifié, Proposition, Négociation, Gagné, Perdu)"),
      montantEstime: z.number().optional(),
      montantFinal: z
        .number()
        .nullable()
        .optional()
        .describe("Montant final signé en €"),
      modalitesFacturation: z.string().optional(),
      dateSignature: z
        .string()
        .nullable()
        .optional()
        .describe("Date de signature (YYYY-MM-DD)"),
    },
    async ({ dealId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.titre !== undefined) data.titre = updates.titre;
      if (updates.etape !== undefined) data.etape = updates.etape;
      if (updates.montantEstime !== undefined)
        data.montantEstime = updates.montantEstime;
      if (updates.montantFinal !== undefined)
        data.montantFinal = updates.montantFinal;
      if (updates.modalitesFacturation !== undefined)
        data.modalitesFacturation = updates.modalitesFacturation;
      if (updates.dateSignature !== undefined) {
        data.dateSignature = updates.dateSignature
          ? new Date(updates.dateSignature)
          : null;
      }

      const deal = await prisma.deal.update({
        where: { id: dealId },
        data,
        include: { client: { select: { entreprise: true, nom: true } } },
      });
      const client = deal.client.entreprise || deal.client.nom;
      return {
        content: [
          {
            type: "text" as const,
            text: `Deal [${deal.id}] mis à jour : ${deal.titre} | ${deal.etape} | Client: ${client}`,
          },
        ],
      };
    },
  );

  // 20. Get proposition detail
  server.tool(
    "get_proposition",
    "Détail complet d'une proposition commerciale (sections, sous-sections, planning)",
    {
      propositionId: z.number().describe("ID de la proposition"),
    },
    async ({ propositionId }) => {
      const p = await prisma.propositionCommerciale.findUnique({
        where: { id: propositionId },
        include: {
          deal: { include: { client: true } },
          sections: {
            include: { sousSections: { orderBy: { ordre: "asc" } } },
            orderBy: { ordre: "asc" },
          },
          planningEtapes: { orderBy: { ordre: "asc" } },
        },
      });

      if (!p)
        return {
          content: [
            {
              type: "text" as const,
              text: `Proposition ${propositionId} non trouvée.`,
            },
          ],
        };

      const client = p.deal.client.entreprise || p.deal.client.nom;
      let text = `# Proposition [${p.id}] ${p.nom || "—"}\n`;
      text += `Deal: ${p.deal.titre} | Client: ${client}\n`;
      text += `Montant total: ${fmtCurrency(dec(p.montantTotal))} | Langue: ${p.langue} | Devise: ${p.devise}\n`;
      text += `TVA: ${dec(p.tauxTva)}% | Gestion projet: ${dec(p.tauxGestionProjet)}% | TJM gestion: ${fmtCurrency(dec(p.tjmGestionProjet))}\n`;
      text += `Token public: ${p.publicToken}\n`;
      if (p.dateDebutProjet)
        text += `Date début projet: ${fmtDate(p.dateDebutProjet)}\n`;

      if (p.introduction) text += `\n## Introduction\n${p.introduction}\n`;
      if (p.conclusion) text += `\n## Conclusion\n${p.conclusion}\n`;

      if (p.sections.length > 0) {
        text += `\n## Sections (${p.sections.length})\n`;
        for (const s of p.sections) {
          text += `\n### [${s.id}] ${s.titre}${s.estOption ? " (OPTION)" : ""}\n`;
          if (s.description) text += `${s.description}\n`;
          for (const ss of s.sousSections) {
            text += `  - [${ss.id}] ${ss.titre} : ${dec(ss.nombreJours)}j × ${fmtCurrency(dec(ss.tjm))}${dec(ss.remise) > 0 ? ` - ${dec(ss.remise)}%` : ""}\n`;
          }
        }
      }

      if (p.planningEtapes.length > 0) {
        text += `\n## Planning (${p.planningEtapes.length} étapes)\n`;
        for (const e of p.planningEtapes) {
          text += `- ${e.titre} : ${e.nombreSemaines ? `${dec(e.nombreSemaines)} sem.` : "—"}\n`;
        }
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 21. Create proposition
  server.tool(
    "create_proposition",
    "Créer une nouvelle proposition commerciale complète (avec sections, sous-sections, planning, bénéfices, etc.)",
    {
      dealId: z.number().describe("ID du deal associé"),
      nom: z.string().optional().describe("Nom de la proposition"),
      introduction: z.string().optional().describe("Texte d'introduction"),
      conclusion: z.string().optional().describe("Texte de conclusion"),
      langue: z
        .enum(["fr", "en"])
        .optional()
        .describe("Langue (fr par défaut)"),
      devise: z.string().optional().describe("Devise (EUR par défaut)"),
      tauxTva: z.number().optional().describe("Taux de TVA en % (20 par défaut)"),
      remiseGlobale: z
        .number()
        .optional()
        .describe("Remise globale en % (0 par défaut)"),
      tauxGestionProjet: z
        .number()
        .optional()
        .describe("Taux de gestion projet en % (20 par défaut)"),
      tjmGestionProjet: z
        .number()
        .optional()
        .describe("TJM de la gestion projet (800 par défaut)"),
      dateDebutProjet: z
        .string()
        .optional()
        .describe("Date de début du projet (YYYY-MM-DD)"),
      sections: z
        .array(
          z.object({
            titre: z.string(),
            description: z.string().optional(),
            estOption: z.boolean().optional(),
            sousSections: z.array(
              z.object({
                titre: z.string(),
                description: z.string().optional(),
                nombreJours: z.number(),
                tjm: z.number().optional().describe("TJM (défaut: 800)"),
                remise: z.number().optional().describe("Remise en %"),
              }),
            ),
          }),
        )
        .optional()
        .describe("Sections avec sous-sections"),
      planningEtapes: z
        .array(
          z.object({
            titre: z.string(),
            description: z.string().optional(),
            nombreSemaines: z.number().optional(),
          }),
        )
        .optional()
        .describe("Étapes de rétro-planning"),
      beneficesCles: z
        .array(
          z.object({
            titre: z.string(),
            description: z.string(),
            icone: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "3 bénéfices clés. Icônes possibles : lightning, shield, users, rocket, star, target, trending-up, check-circle, award, code",
        ),
      informationsComplementaires: z
        .array(
          z.object({
            titre: z.string(),
            description: z.string(),
            icone: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "Informations complémentaires. Icônes possibles : calendar, clipboard, support, euro",
        ),
    },
    async ({
      dealId,
      nom,
      introduction,
      conclusion,
      langue,
      devise,
      tauxTva,
      remiseGlobale,
      tauxGestionProjet,
      tjmGestionProjet,
      dateDebutProjet,
      sections,
      planningEtapes,
      beneficesCles,
      informationsComplementaires,
    }) => {
      const publicToken = randomBytes(32).toString("hex");

      const proposition = await prisma.propositionCommerciale.create({
        data: {
          dealId,
          nom: nom ?? null,
          publicToken,
          introduction: introduction ?? null,
          conclusion: conclusion ?? null,
          langue: langue ?? "fr",
          devise: devise ?? "EUR",
          tauxTva: tauxTva ?? 20,
          remiseGlobale: remiseGlobale ?? 0,
          tauxGestionProjet: tauxGestionProjet ?? 20,
          tjmGestionProjet: tjmGestionProjet ?? 800,
          dateDebutProjet: dateDebutProjet ? new Date(dateDebutProjet) : null,
          beneficesCles: beneficesCles ? JSON.stringify(beneficesCles) : null,
          informationsComplementaires: informationsComplementaires
            ? JSON.stringify(informationsComplementaires)
            : null,
        },
      });

      // Create sections with sous-sections
      if (sections && sections.length > 0) {
        for (let si = 0; si < sections.length; si++) {
          const s = sections[si];
          const section = await prisma.propositionCommercialeSection.create({
            data: {
              propositionCommercialeId: proposition.id,
              titre: s.titre,
              description: s.description ?? null,
              ordre: si,
              estOption: s.estOption ?? false,
            },
          });

          for (let ssi = 0; ssi < s.sousSections.length; ssi++) {
            const ss = s.sousSections[ssi];
            await prisma.propositionCommercialeSousSection.create({
              data: {
                sectionId: section.id,
                titre: ss.titre,
                description: ss.description ?? null,
                nombreJours: ss.nombreJours,
                tjm: ss.tjm ?? 800,
                ordre: ssi,
                remise: ss.remise ?? 0,
              },
            });
          }
        }
      }

      // Create planning étapes
      if (planningEtapes && planningEtapes.length > 0) {
        for (let i = 0; i < planningEtapes.length; i++) {
          const e = planningEtapes[i];
          await prisma.propositionCommercialePlanningEtape.create({
            data: {
              propositionCommercialeId: proposition.id,
              titre: e.titre,
              description: e.description ?? null,
              ordre: i,
              nombreSemaines: e.nombreSemaines ?? null,
            },
          });
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Proposition créée : [${proposition.id}] ${proposition.nom || "—"} | Deal: ${dealId} | Token: ${publicToken}\nURL publique : /proposition/${publicToken}`,
          },
        ],
      };
    },
  );

  // 22. Create client
  server.tool(
    "create_client",
    "Créer un nouveau client",
    {
      nom: z.string().describe("Nom du contact"),
      email: z.string().describe("Email du contact"),
      entreprise: z.string().optional().describe("Nom de l'entreprise"),
      telephone: z.string().optional(),
      statut: z
        .enum(["prospect", "actif", "inactif"])
        .optional()
        .describe("Statut (défaut: prospect)"),
    },
    async ({ nom, email, entreprise, telephone, statut }) => {
      const client = await prisma.client.create({
        data: {
          nom,
          email,
          entreprise: entreprise ?? null,
          telephone: telephone ?? null,
          statut: statut ?? "prospect",
        },
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Client créé : [${client.id}] ${client.entreprise || client.nom} | ${client.statut} | ${client.email}`,
          },
        ],
      };
    },
  );

  // 23. Update client
  server.tool(
    "update_client",
    "Modifier un client (nom, email, entreprise, téléphone, statut)",
    {
      clientId: z.number().describe("ID du client"),
      nom: z.string().optional(),
      email: z.string().optional(),
      entreprise: z.string().optional(),
      telephone: z.string().optional(),
      statut: z.enum(["prospect", "actif", "inactif"]).optional(),
    },
    async ({ clientId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.nom !== undefined) data.nom = updates.nom;
      if (updates.email !== undefined) data.email = updates.email;
      if (updates.entreprise !== undefined)
        data.entreprise = updates.entreprise;
      if (updates.telephone !== undefined) data.telephone = updates.telephone;
      if (updates.statut !== undefined) data.statut = updates.statut;

      const client = await prisma.client.update({
        where: { id: clientId },
        data,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Client [${client.id}] mis à jour : ${client.entreprise || client.nom}`,
          },
        ],
      };
    },
  );

  // 24. Get deal detail
  server.tool(
    "get_deal",
    "Détail complet d'un deal : propositions, factures, projets associés",
    {
      dealId: z.number().describe("ID du deal"),
    },
    async ({ dealId }) => {
      const d = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          client: true,
          propositions: {
            select: {
              id: true,
              nom: true,
              montantTotal: true,
              publicToken: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          dealFactures: true,
          projects: {
            select: { id: true, titre: true, statut: true, budgetTotal: true },
          },
        },
      });

      if (!d)
        return {
          content: [
            { type: "text" as const, text: `Deal ${dealId} non trouvé.` },
          ],
        };

      const client = d.client.entreprise || d.client.nom;
      const totalFacture = d.dealFactures.reduce(
        (s: number, f: { montantHT: unknown }) => s + dec(f.montantHT),
        0,
      );

      let text = `# Deal [${d.id}] ${d.titre}\n`;
      text += `Client: ${client} | Étape: ${d.etape}\n`;
      text += `Montant estimé: ${fmtCurrency(dec(d.montantEstime))}`;
      if (d.montantFinal)
        text += ` | Signé: ${fmtCurrency(dec(d.montantFinal))}`;
      text += `\n`;
      if (d.dateSignature)
        text += `Signé le: ${fmtDate(d.dateSignature)}\n`;
      text += `Facturé: ${fmtCurrency(totalFacture)}\n`;

      if (d.propositions.length > 0) {
        text += `\n## Propositions commerciales (${d.propositions.length})\n`;
        for (const p of d.propositions) {
          text += `- [${p.id}] ${p.nom || "Sans nom"} | ${fmtCurrency(dec(p.montantTotal))} | ${fmtDate(p.createdAt)} | /proposition/${p.publicToken}\n`;
        }
      }

      if (d.projects.length > 0) {
        text += `\n## Projets (${d.projects.length})\n`;
        for (const p of d.projects) {
          text += `- [${p.id}] ${p.titre} | ${p.statut} | Budget: ${fmtCurrency(dec(p.budgetTotal))}\n`;
        }
      }

      if (d.dealFactures.length > 0) {
        text += `\n## Factures (${d.dealFactures.length})\n`;
        for (const f of d.dealFactures) {
          text += `- [${f.id}] ${f.numero} | ${fmtCurrency(dec(f.montantHT))} HT | ${fmtDate(f.dateFacture)}\n`;
        }
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 25. List propositions
  server.tool(
    "list_propositions",
    "Liste les propositions commerciales d'un deal ou de tous les deals",
    {
      dealId: z.number().optional().describe("Filtrer par deal"),
    },
    async ({ dealId }) => {
      const where: Record<string, unknown> = {};
      if (dealId) where.dealId = dealId;

      const propositions = await prisma.propositionCommerciale.findMany({
        where,
        include: {
          deal: {
            include: { client: { select: { entreprise: true, nom: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      if (propositions.length === 0)
        return {
          content: [
            { type: "text" as const, text: "Aucune proposition trouvée." },
          ],
        };

      const lines = propositions.map(
        (p: {
          id: number;
          nom: string | null;
          montantTotal: unknown;
          publicToken: string;
          createdAt: Date | null;
          deal: {
            titre: string;
            client: { entreprise: string | null; nom: string };
          };
        }) => {
          const client = p.deal.client.entreprise || p.deal.client.nom;
          return `[${p.id}] ${p.nom || "Sans nom"} | Deal: ${p.deal.titre} | Client: ${client} | ${fmtCurrency(dec(p.montantTotal))} | ${fmtDate(p.createdAt)} | Token: ${p.publicToken}`;
        },
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );

  // 26. Create project
  server.tool(
    "create_project",
    "Créer un nouveau projet (généralement depuis un deal gagné)",
    {
      titre: z.string().describe("Titre du projet"),
      clientId: z.number().optional().describe("ID du client"),
      dealId: z.number().optional().describe("ID du deal associé"),
      chefProjetId: z.number().optional().describe("ID du chef de projet"),
      description: z.string().optional(),
      budgetTotal: z.number().optional().describe("Budget total en €"),
      joursVendus: z.number().optional().describe("Jours vendus"),
      statut: z
        .enum(["en_cours", "en_attente", "termine"])
        .optional()
        .describe("Statut (défaut: en_attente)"),
      dateDebut: z.string().optional().describe("YYYY-MM-DD"),
      dateFin: z.string().optional().describe("YYYY-MM-DD"),
      deadline: z.string().optional().describe("YYYY-MM-DD"),
      githubUrl: z.string().optional(),
      figmaUrl: z.string().optional(),
    },
    async ({
      titre,
      clientId,
      dealId,
      chefProjetId,
      description,
      budgetTotal,
      joursVendus,
      statut,
      dateDebut,
      dateFin,
      deadline,
      githubUrl,
      figmaUrl,
    }) => {
      const project = await prisma.project.create({
        data: {
          titre,
          clientId: clientId ?? null,
          dealId: dealId ?? null,
          chefProjetId: chefProjetId ?? null,
          description: description ?? null,
          budgetTotal: budgetTotal ?? 0,
          joursVendus: joursVendus ?? null,
          statut: statut ?? "en_attente",
          dateDebut: dateDebut ? new Date(dateDebut) : null,
          dateFin: dateFin ? new Date(dateFin) : null,
          deadline: deadline ? new Date(deadline) : null,
          githubUrl: githubUrl ?? null,
          figmaUrl: figmaUrl ?? null,
        },
        include: { client: { select: { entreprise: true, nom: true } } },
      });
      const clientName =
        project.client?.entreprise || project.client?.nom || "—";
      return {
        content: [
          {
            type: "text" as const,
            text: `Projet créé : [${project.id}] ${project.titre} | ${project.statut} | Client: ${clientName} | Budget: ${fmtCurrency(dec(project.budgetTotal))}`,
          },
        ],
      };
    },
  );

  // 27. List tasks
  server.tool(
    "list_tasks",
    "Liste les tâches avec filtrage par projet, assigné, statut ou priorité",
    {
      projectId: z.number().optional().describe("Filtrer par projet"),
      userId: z.number().optional().describe("Filtrer par assigné"),
      statutKanban: z
        .enum(["todo", "in_progress", "review", "done"])
        .optional()
        .describe("Filtrer par statut"),
      priorityLevel: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe("Filtrer par priorité (1=basse, 4=urgente)"),
      limit: z.number().optional().describe("Nombre max (défaut: 100)"),
    },
    async ({ projectId, userId, statutKanban, priorityLevel, limit }) => {
      const where: Record<string, unknown> = {};
      if (projectId) where.projectId = projectId;
      if (userId) where.userId = userId;
      if (statutKanban) where.statutKanban = statutKanban;
      if (priorityLevel) where.priorityLevel = priorityLevel;

      const tasks = await prisma.task.findMany({
        where,
        include: {
          project: { select: { titre: true } },
          user: { select: { name: true } },
        },
        orderBy: [{ priorityLevel: "desc" }, { createdAt: "desc" }],
        take: limit ?? 100,
      });

      if (tasks.length === 0)
        return {
          content: [
            { type: "text" as const, text: "Aucune tâche trouvée." },
          ],
        };

      const lines = tasks.map(
        (t: {
          id: number;
          titre: string;
          statutKanban: string;
          priorityLevel: number;
          categorie: string | null;
          project: { titre: string };
          user: { name: string } | null;
        }) => {
          const assignee = t.user?.name || "—";
          return `[${t.id}] ${t.titre} | ${t.statutKanban} | P${t.priorityLevel} | Projet: ${t.project.titre} | Assigné: ${assignee}${t.categorie ? ` | ${t.categorie}` : ""}`;
        },
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );

  // 28. Assign half-day slot (planning)
  server.tool(
    "assign_half_day",
    "Assigner une personne à une demi-journée sur un projet (planning par slots)",
    {
      userId: z.number().describe("ID de l'utilisateur"),
      projectId: z.number().describe("ID du projet"),
      date: z.string().describe("Date au format YYYY-MM-DD"),
      period: z.enum(["AM", "PM"]).describe("Matin (AM) ou après-midi (PM)"),
    },
    async ({ userId, projectId, date, period }) => {
      const slot = await prisma.halfDaySlot.upsert({
        where: {
          userId_date_period: {
            userId,
            date: new Date(date),
            period,
          },
        },
        update: { projectId },
        create: {
          userId,
          projectId,
          date: new Date(date),
          period,
        },
        include: {
          user: { select: { name: true } },
          project: { select: { titre: true } },
        },
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Demi-journée assignée : ${slot.user.name} le ${date} ${period} → ${slot.project.titre}`,
          },
        ],
      };
    },
  );

  // 29. Remove half-day slot
  server.tool(
    "remove_half_day",
    "Retirer l'assignation d'une demi-journée",
    {
      userId: z.number().describe("ID de l'utilisateur"),
      date: z.string().describe("Date YYYY-MM-DD"),
      period: z.enum(["AM", "PM"]).describe("AM ou PM"),
    },
    async ({ userId, date, period }) => {
      const deleted = await prisma.halfDaySlot.deleteMany({
        where: { userId, date: new Date(date), period },
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              deleted.count > 0
                ? `Demi-journée supprimée : user ${userId} le ${date} ${period}`
                : `Aucune demi-journée trouvée pour user ${userId} le ${date} ${period}`,
          },
        ],
      };
    },
  );

  // 30. Get project profitability
  server.tool(
    "get_project_profitability",
    "Analyse de rentabilité d'un projet : budget vendu, temps consommé, marge estimée",
    {
      projectId: z.number().describe("ID du projet"),
    },
    async ({ projectId }) => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          client: { select: { entreprise: true, nom: true } },
          timeEntries: {
            include: { user: { select: { name: true, tjm: true } } },
          },
        },
      });

      if (!project)
        return {
          content: [
            {
              type: "text" as const,
              text: `Projet ${projectId} non trouvé.`,
            },
          ],
        };

      const budget = dec(project.budgetTotal);
      const joursVendus = project.joursVendus ? dec(project.joursVendus) : null;

      // Compute consumed cost based on hours logged × user TJM / 7
      let heuresConsommees = 0;
      let coutReel = 0;
      const byUser = new Map<string, { heures: number; cout: number }>();

      for (const entry of project.timeEntries) {
        const heures = dec(entry.duree);
        const tjm = entry.user.tjm ? dec(entry.user.tjm) : 800;
        const coutHeure = tjm / 7; // ~7h par jour
        const cout = heures * coutHeure;
        heuresConsommees += heures;
        coutReel += cout;

        const existing = byUser.get(entry.user.name) ?? { heures: 0, cout: 0 };
        existing.heures += heures;
        existing.cout += cout;
        byUser.set(entry.user.name, existing);
      }

      const joursConsommes = heuresConsommees / 7;
      const margeEstimee = budget - coutReel;
      const tauxMarge = budget > 0 ? (margeEstimee / budget) * 100 : 0;
      const avancement = joursVendus
        ? (joursConsommes / joursVendus) * 100
        : null;

      const clientName =
        project.client?.entreprise || project.client?.nom || "—";

      let text = `# Rentabilité — ${project.titre}\n`;
      text += `Client: ${clientName} | Statut: ${project.statut}\n\n`;
      text += `## Budget & Avancement\n`;
      text += `Budget vendu: ${fmtCurrency(budget)}\n`;
      if (joursVendus) {
        text += `Jours vendus: ${joursVendus}j | Consommés: ${joursConsommes.toFixed(1)}j (${avancement?.toFixed(0)}%)\n`;
        text += `Reste à faire: ${(joursVendus - joursConsommes).toFixed(1)}j\n`;
      } else {
        text += `Jours consommés: ${joursConsommes.toFixed(1)}j\n`;
      }
      text += `\n## Rentabilité\n`;
      text += `Coût réel estimé: ${fmtCurrency(coutReel)}\n`;
      text += `Marge estimée: ${fmtCurrency(margeEstimee)} (${tauxMarge.toFixed(1)}%)\n`;

      if (byUser.size > 0) {
        text += `\n## Répartition par personne\n`;
        for (const [name, data] of byUser) {
          text += `- ${name}: ${(data.heures / 7).toFixed(1)}j (${data.heures.toFixed(1)}h) | Coût: ${fmtCurrency(data.cout)}\n`;
        }
      }

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // 31. Duplicate proposition
  server.tool(
    "duplicate_proposition",
    "Dupliquer une proposition existante (utile pour créer une v2 à partir d'une v1)",
    {
      propositionId: z.number().describe("ID de la proposition à dupliquer"),
      nouveauNom: z
        .string()
        .optional()
        .describe("Nouveau nom (défaut: nom original + ' (copie)')"),
    },
    async ({ propositionId, nouveauNom }) => {
      const original = await prisma.propositionCommerciale.findUnique({
        where: { id: propositionId },
        include: {
          sections: { include: { sousSections: true } },
          planningEtapes: true,
        },
      });

      if (!original)
        return {
          content: [
            {
              type: "text" as const,
              text: `Proposition ${propositionId} non trouvée.`,
            },
          ],
        };

      const newToken = randomBytes(32).toString("hex");
      const copy = await prisma.propositionCommerciale.create({
        data: {
          dealId: original.dealId,
          nom:
            nouveauNom ||
            (original.nom ? `${original.nom} (copie)` : "Copie"),
          publicToken: newToken,
          montantTotal: original.montantTotal,
          introduction: original.introduction,
          conclusion: original.conclusion,
          remiseGlobale: original.remiseGlobale,
          langue: original.langue,
          devise: original.devise,
          tauxTva: original.tauxTva,
          tauxGestionProjet: original.tauxGestionProjet,
          tjmGestionProjet: original.tjmGestionProjet,
          beneficesCles: original.beneficesCles,
          informationsComplementaires: original.informationsComplementaires,
          callToAction: original.callToAction,
          references: original.references,
          dateDebutProjet: original.dateDebutProjet,
          logoEntreprise: original.logoEntreprise,
          logoClient: original.logoClient,
        },
      });

      for (const s of original.sections) {
        const newSection = await prisma.propositionCommercialeSection.create({
          data: {
            propositionCommercialeId: copy.id,
            titre: s.titre,
            description: s.description,
            ordre: s.ordre,
            estOption: s.estOption,
          },
        });
        for (const ss of s.sousSections) {
          await prisma.propositionCommercialeSousSection.create({
            data: {
              sectionId: newSection.id,
              titre: ss.titre,
              description: ss.description,
              nombreJours: ss.nombreJours,
              tjm: ss.tjm,
              ordre: ss.ordre,
              remise: ss.remise,
            },
          });
        }
      }

      for (const e of original.planningEtapes) {
        await prisma.propositionCommercialePlanningEtape.create({
          data: {
            propositionCommercialeId: copy.id,
            titre: e.titre,
            description: e.description,
            ordre: e.ordre,
            nombreSemaines: e.nombreSemaines,
          },
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Proposition dupliquée : [${copy.id}] ${copy.nom} | Token: ${newToken}`,
          },
        ],
      };
    },
  );

  // Update proposition (top-level fields only)
  server.tool(
    "update_proposition",
    "Modifier les champs principaux d'une proposition (nom, intro, conclusion, taux, etc.). Pour modifier les sections/sous-sections, utilisez update_proposition_section.",
    {
      propositionId: z.number().describe("ID de la proposition"),
      nom: z.string().optional(),
      introduction: z.string().optional(),
      conclusion: z.string().optional(),
      langue: z.enum(["fr", "en"]).optional(),
      devise: z.string().optional(),
      tauxTva: z.number().optional(),
      remiseGlobale: z.number().optional(),
      tauxGestionProjet: z.number().optional(),
      tjmGestionProjet: z.number().optional(),
      dateDebutProjet: z
        .string()
        .nullable()
        .optional()
        .describe("YYYY-MM-DD"),
    },
    async ({ propositionId, ...updates }) => {
      const data: Record<string, unknown> = {};
      if (updates.nom !== undefined) data.nom = updates.nom;
      if (updates.introduction !== undefined)
        data.introduction = updates.introduction;
      if (updates.conclusion !== undefined)
        data.conclusion = updates.conclusion;
      if (updates.langue !== undefined) data.langue = updates.langue;
      if (updates.devise !== undefined) data.devise = updates.devise;
      if (updates.tauxTva !== undefined) data.tauxTva = updates.tauxTva;
      if (updates.remiseGlobale !== undefined)
        data.remiseGlobale = updates.remiseGlobale;
      if (updates.tauxGestionProjet !== undefined)
        data.tauxGestionProjet = updates.tauxGestionProjet;
      if (updates.tjmGestionProjet !== undefined)
        data.tjmGestionProjet = updates.tjmGestionProjet;
      if (updates.dateDebutProjet !== undefined) {
        data.dateDebutProjet = updates.dateDebutProjet
          ? new Date(updates.dateDebutProjet)
          : null;
      }

      const p = await prisma.propositionCommerciale.update({
        where: { id: propositionId },
        data,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Proposition [${p.id}] mise à jour : ${p.nom || "—"}`,
          },
        ],
      };
    },
  );

  return server;
}
