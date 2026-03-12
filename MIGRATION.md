# Migration MySQL (Infomaniak) -> PostgreSQL (Render)

Guide de migration des donnees de CinqCentral V1 (MySQL/MariaDB sur Infomaniak) vers V2 (PostgreSQL sur Render).

## Architecture cible

```
+----------------------+      +----------------------------+
|  Render Web Service  | ---- |  Render PostgreSQL         |
|  (Next.js standalone)|      |  (plan Basic, Frankfurt)   |
|  Frankfurt region    |      |  DATABASE_URL auto-liee    |
+----------------------+      +----------------------------+
```

---

## Prerequis

- **psql** installe localement (`brew install postgresql` sur macOS)
- Acces a phpMyAdmin Infomaniak
- Acces au dashboard Render avec la base PostgreSQL creee
- Node.js >= 20

---

## Etape 1 — Exporter le dump MySQL

1. Aller sur phpMyAdmin Infomaniak
2. Selectionner la base `0n71bc_central`
3. Exporter en **SQL** avec les options :
   - Format : SQL
   - Methode : Personnalisee
   - Encodage : UTF-8
4. Sauvegarder le fichier `.sql`

---

## Etape 2 — Recuperer la connection string PostgreSQL

Dans le dashboard Render :
1. Aller dans **Databases** > `cinq-central-db`
2. Copier la **External Database URL**

Format : `postgresql://cinq:PASSWORD@HOST:5432/cinq_central`

---

## Etape 3 — Lancer la migration

```bash
cd cinq-central-v2
./scripts/migrate-mysql-to-pg.sh chemin/vers/dump.sql "postgresql://cinq:PASSWORD@HOST:5432/cinq_central"
```

Le script effectue 4 etapes :
1. **Schema** — Cree les tables PostgreSQL via `prisma db push`
2. **Conversion** — Convertit le SQL MySQL en SQL PostgreSQL compatible
3. **Import** — Insere les donnees dans PostgreSQL
4. **Verification** — Affiche le nombre de lignes par table

---

## Mapping des tables

### Tables migrees automatiquement

| MySQL (V1) | PostgreSQL (V2) | Notes |
|---|---|---|
| `clients` | `clients` | Direct |
| `users` | `users` | Roles `pm`/`commercial` -> `equipe` |
| `deals` | `deals` | Direct |
| `projects` | `projects` | Booleens `tinyint` -> `boolean` |
| `tasks` | `tasks` | Booleens `tinyint` -> `boolean` |
| `tickets` | `tickets` | `user_id` -> `createur_id`, ajout `statut` |
| `ticket_files` | `ticket_attachments` | Colonnes renommees |
| `transactions` | `transactions` | Direct |
| `proposition_commerciales` | `proposition_commerciales` | Direct |
| `proposition_commerciale_sections` | `proposition_commerciale_sections` | Direct |
| `proposition_commerciale_sous_sections` | `proposition_commerciale_sous_sections` | Direct |
| `proposition_commerciale_planning_etapes` | `proposition_commerciale_planning_etapes` | Direct |

### Tables NON migrees (volontaire)

| Table | Raison |
|---|---|
| `cache`, `sessions` | Donnees de runtime, regenerees automatiquement |
| `migrations` | Specifique a Laravel |
| `sprints`, `sprint_task` | Feature retiree en V2 |
| `project_templates`, `project_template_tasks` | Feature retiree en V2 |
| `forecast_expense_entries`, `forecast_revenue_entries` | Remplace par `forecast_expenses_v2` |
| `calendar_event_imports` | Feature retiree en V2 |
| `time_entries` (V1) | Schema completement different en V2 |

### Tables nouvelles (V2 uniquement)

| Table | Description |
|---|---|
| `metiers` | Metiers de l'equipe (dev, design, etc.) |
| `user_metiers` | Association utilisateur <-> metier |
| `project_allocations` | Allocation de jours par metier sur un projet |
| `time_entries_v2` | Timetracking par semaine (nouveau format) |
| `deal_factures` | Factures liees aux deals (sync Qonto) |
| `deal_revenu_planifie` | Previsionnel de revenus par mois |
| `forecast_expenses_v2` | Previsionnel de depenses |
| `invoice_planification` | Planification des factures |

---

## Changements de schema importants

### TimeEntry (incompatible)

**V1** : une entree = une session de travail avec `started_at`, `ended_at`, `duration_minutes`, `date`

**V2** : une entree = une saisie hebdomadaire avec `semaine` (format "2026-W11"), `duree` (en heures), `categorie`

Les time entries V1 ne sont **pas migrees automatiquement**. Si tu as besoin des donnees historiques, il faudra un script de conversion specifique.

### Tickets

- `user_id` -> `createur_id` (le createur du ticket)
- Nouveau champ `assigne_id` (personne assignee)
- Champs supprimes : `lien`, `position_x`, `position_y`, `type`, `est_resolu`
- Nouveaux champs : `statut`, `navigateur`, `taille_ecran`, `meta_info`

### Roles utilisateurs

| V1 | V2 |
|---|---|
| `admin` | `admin` |
| `pm` | `equipe` |
| `commercial` | `equipe` |
| `client` | `client` |

---

## Etape 4 — Creer les donnees V2

Apres la migration, creer les nouvelles entites dans l'interface admin :

### Metiers

```sql
INSERT INTO metiers (nom, created_at) VALUES
  ('Developpement', NOW()),
  ('Design', NOW()),
  ('Gestion de projet', NOW()),
  ('Marketing', NOW());
```

### User-Metiers et Allocations

Configurer via l'interface admin de l'application.

---

## Etape 5 — Configurer Google OAuth

1. Aller dans la [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Ajouter l'URI de redirection :
   ```
   https://app.cinqteam.com/api/auth/callback/google
   ```
3. Verifier que `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont dans les variables Render

---

## Etape 6 — Domaine personnalise

1. Dans Render > Settings > Custom Domains, ajouter `app.cinqteam.com`
2. Ajouter un enregistrement DNS :
   ```
   CNAME  app  cinq-central.onrender.com
   ```
3. Render provisionne le certificat SSL automatiquement
4. Mettre a jour `NEXTAUTH_URL` et `NEXT_PUBLIC_APP_URL` avec `https://app.cinqteam.com`
5. Mettre a jour l'URI de callback Google OAuth
6. Ajouter `AUTH_TRUST_HOST=true` dans les variables d'environnement

---

## Verification post-migration

- [ ] L'app repond sur l'URL de production
- [ ] Login Google OAuth fonctionne
- [ ] Les donnees existantes (clients, projets, deals) sont presentes
- [ ] Les booleens sont correctement migres
- [ ] Les montants Decimal sont corrects
- [ ] Le widget tickets fonctionne
- [ ] Les propositions commerciales publiques sont accessibles

---

## Rollback

La V1 reste sur Infomaniak avec sa BDD MySQL intacte. Aucune modification n'est faite sur la source. Pour revenir en arriere, repointer le DNS vers l'ancien serveur.
