# Migration CinqCentral V1 → V2 (Render + PostgreSQL)

## Architecture cible

```
┌─────────────────────┐      ┌──────────────────────────┐
│  Render Web Service  │ ──── │  Render PostgreSQL        │
│  (Next.js app)       │      │  (plan Starter, 7$/mois)  │
│  Frankfurt region    │      │  Frankfurt region          │
└─────────────────────┘      └──────────────────────────┘
```

Tout est sur Render, meme region, zero latence.

---

## Pre-requis

- Acces SSH/MySQL a la BDD Infomaniak existante
- `pgloader` installe en local (`brew install pgloader`)
- Repo GitHub connecte a Render

---

## Etape 1 — Backup de la BDD MySQL existante

```bash
mysqldump -h 0n71bc.myd.infomaniak.com \
  -u 0n71bc_central -p \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  0n71bc_central > backup_mysql_$(date +%Y%m%d).sql
```

Verifier que le dump est complet :

```bash
tail -5 backup_mysql_$(date +%Y%m%d).sql
# Doit afficher "Dump completed"
```

---

## Etape 2 — Executer la migration V1 → V2 sur MySQL

Si ce n'est pas deja fait, appliquer le script de migration sur la BDD Infomaniak :

```bash
mysql -h 0n71bc.myd.infomaniak.com \
  -u 0n71bc_central -p \
  0n71bc_central < migration-v2.sql
```

Ce script :
- Convertit les colonnes `enum` en `varchar`
- Restructure la table `tickets`
- Renomme `ticket_files` → `ticket_attachments`
- Cree les nouvelles tables V2

---

## Etape 3 — Deployer sur Render (Blueprint)

### 3.1 Creer les services via Blueprint

1. Aller sur [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Blueprint** → connecter le repo GitHub
3. Render detecte `render.yaml` et cree automatiquement :
   - Un **Web Service** `cinq-central`
   - Une **base PostgreSQL** `cinq-central-db`
4. La variable `DATABASE_URL` est auto-configuree

### 3.2 Configurer les variables d'environnement

Dans le dashboard Render > Environment, remplir les variables `sync: false` :

| Variable | Valeur |
|----------|--------|
| `NEXTAUTH_URL` | `https://cinq-central.onrender.com` (ou domaine custom) |
| `NEXT_PUBLIC_APP_URL` | Meme valeur que `NEXTAUTH_URL` |
| `GOOGLE_CLIENT_ID` | Ton Client ID Google |
| `GOOGLE_CLIENT_SECRET` | Ton Client Secret Google |
| `QONTO_LOGIN` | Login API Qonto |
| `QONTO_SECRET_KEY` | Cle API Qonto |

`AUTH_SECRET` et `DATABASE_URL` sont auto-generes par le blueprint.

### 3.3 Google OAuth — Ajouter l'URL de callback

Dans la [Google Cloud Console](https://console.cloud.google.com/apis/credentials) :

```
https://cinq-central.onrender.com/api/auth/callback/google
```

---

## Etape 4 — Migrer les donnees MySQL → PostgreSQL

### 4.1 Recuperer l'URL PostgreSQL Render

Dans le dashboard Render > PostgreSQL > cinq-central-db > **Info** > **External Database URL**.

Format : `postgresql://cinq:PASSWORD@HOST:5432/cinq_central`

### 4.2 Creer le schema PostgreSQL

Depuis le projet local :

```bash
# Pointer Prisma vers la BDD Render
export DATABASE_URL="postgresql://cinq:PASSWORD@HOST:5432/cinq_central"

# Pousser le schema (cree les tables vides)
npx prisma db push
```

### 4.3 Migrer les donnees avec pgloader

Creer un fichier `pgloader.conf` :

```
LOAD DATABASE
  FROM mysql://0n71bc_central:MOT_DE_PASSE@0n71bc.myd.infomaniak.com:3306/0n71bc_central
  INTO postgresql://cinq:PASSWORD@HOST:5432/cinq_central

WITH
  data only,
  truncate,
  disable triggers,
  reset sequences

EXCLUDING TABLE NAMES MATCHING
  'migrations',
  'failed_jobs',
  'password_reset_tokens',
  'personal_access_tokens',
  'sessions',
  'time_entries'

CAST
  type tinyint to boolean using tinyint-to-boolean
;
```

Lancer la migration :

```bash
pgloader pgloader.conf
```

### 4.4 Verifier les donnees

```bash
# Se connecter a la BDD PostgreSQL Render
psql "postgresql://cinq:PASSWORD@HOST:5432/cinq_central"

# Verifier les comptes
SELECT count(*) FROM users;
SELECT count(*) FROM clients;
SELECT count(*) FROM projects;
SELECT count(*) FROM deals;
SELECT count(*) FROM transactions;
SELECT count(*) FROM tickets;
```

### 4.5 Resynchroniser les sequences auto-increment

pgloader ne met pas a jour les sequences PostgreSQL. Les resynchroniser :

```sql
-- Executer dans psql apres l'import
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name,
           pg_get_serial_sequence(c.table_name, c.column_name) AS seq
    FROM information_schema.columns c
    WHERE c.column_default LIKE 'nextval%'
      AND c.table_schema = 'public'
  LOOP
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, false)',
      r.seq, r.column_name, r.table_name
    );
  END LOOP;
END $$;
```

---

## Etape 5 — Domaine personnalise (optionnel)

1. Dans Render > Settings > Custom Domains, ajouter `app.cinqteam.com`
2. Ajouter un enregistrement DNS :

```
CNAME  app  cinq-central.onrender.com
```

3. Render provisionne le certificat SSL automatiquement
4. Mettre a jour `NEXTAUTH_URL` et `NEXT_PUBLIC_APP_URL`
5. Mettre a jour l'URI de callback Google OAuth

---

## Etape 6 — Verification post-migration

- [ ] L'app repond sur l'URL de production
- [ ] Login Google OAuth fonctionne
- [ ] Les donnees existantes (clients, projets, deals) sont presentes
- [ ] Les booleens sont correctement migres (tinyint → boolean)
- [ ] Les montants Decimal sont corrects
- [ ] Le timetracking fonctionne
- [ ] Les transactions et la synchro Qonto fonctionnent
- [ ] Le widget tickets fonctionne (verifier `NEXT_PUBLIC_APP_URL`)
- [ ] Les propositions commerciales publiques sont accessibles

---

## Rollback

La V1 reste sur Infomaniak avec sa BDD MySQL intacte. En cas de probleme :

1. Repointer le DNS vers l'ancien serveur
2. Ou restaurer le dump MySQL :

```bash
mysql -h 0n71bc.myd.infomaniak.com \
  -u 0n71bc_central -p \
  0n71bc_central < backup_mysql_YYYYMMDD.sql
```

---

## Tables exclues de la migration

| Table MySQL | Raison |
|-------------|--------|
| `migrations` | Specifique a Laravel V1 |
| `failed_jobs` | Specifique a Laravel V1 |
| `password_reset_tokens` | Specifique a Laravel V1 |
| `personal_access_tokens` | Specifique a Laravel V1 |
| `sessions` | Specifique a Laravel V1 |
| `time_entries` | Remplacees par `time_entries_v2` |
