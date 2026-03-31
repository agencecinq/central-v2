import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

  return server;
}
