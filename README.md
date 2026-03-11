# CinqCentral

CinqCentral est l'outil interne de gestion de l'agence Cinq. Il centralise la gestion des projets, du CRM, de la finance, du suivi de temps et des tickets clients dans une seule application web.

## Fonctionnalites

- **Dashboard** — Vue d'ensemble de l'activite de l'agence
- **CRM** — Pipeline commercial, deals, propositions commerciales avec generation de devis
- **Projets** — Gestion de projets avec Kanban, Gantt, allocations par metier et charge de travail
- **Tickets** — Suivi de bugs/demandes clients, avec widget integrable sur les sites clients
- **Timetracking** — Saisie du temps par semaine, par projet et par categorie
- **Finance** — Suivi des transactions, previsionnel depenses/revenus, synchronisation Qonto
- **Espace client** — Portail client en lecture seule (projets, factures)
- **Admin** — Gestion des utilisateurs, roles et metiers

## Stack technique

- **Framework** — Next.js 16 (App Router, React 19)
- **ORM** — Prisma 7 avec adapter MariaDB
- **Base de donnees** — MySQL / MariaDB
- **Auth** — Auth.js v5 (Google OAuth + Credentials)
- **UI** — Tailwind CSS 4, shadcn/ui (base-ui), Lucide icons
- **Editeur riche** — Tiptap
- **TypeScript** — Strict mode

## Installation (developpement local)

### Prerequis

- Node.js >= 20
- MySQL ou MariaDB (local ou distant)

### 1. Cloner le repo

```bash
git clone git@github.com:your-org/cinq-central.git
cd cinq-central
```

### 2. Installer les dependances

```bash
npm install
```

### 3. Configurer l'environnement

Creer un fichier `.env.local` a la racine :

```env
# Base de donnees MySQL
DATABASE_URL="mysql://user:password@localhost:3306/cinq_central"

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NextAuth
AUTH_SECRET=your-random-secret  # generer avec: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Qonto API (optionnel)
QONTO_LOGIN=your-qonto-login
QONTO_SECRET_KEY=your-qonto-secret

# URL publique de l'app (pour le widget)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Initialiser la base de donnees

Si c'est une base vierge, importer le schema initial puis executer la migration V2 :

```bash
mysql -u user -p cinq_central < migration-v2.sql
```

Puis generer le client Prisma :

```bash
npx prisma generate
```

### 5. Configurer Google OAuth

Dans la [Google Cloud Console](https://console.cloud.google.com/apis/credentials) :

- Ajouter `http://localhost:3000/api/auth/callback/google` comme URI de redirection autorisee
- En production, ajouter aussi `https://votre-domaine.com/api/auth/callback/google`

### 6. Lancer le serveur de dev

```bash
npm run dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

## Mise en production

### Build

```bash
npm run build
npm start
```

### Deploiement sur VPS (avec PM2)

```bash
# Installer PM2
npm install -g pm2

# Build et lancer
npm run build
pm2 start npm --name cinq-central -- start

# Persistence au redemarrage
pm2 save
pm2 startup
```

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name app.cinqteam.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Variables d'environnement production

Les memes que pour le dev local, avec les valeurs de production :

- `DATABASE_URL` — URL MySQL de production
- `AUTH_SECRET` — Secret unique pour la production
- `NEXTAUTH_URL` — URL publique (ex: `https://app.cinqteam.com`)
- `NEXT_PUBLIC_APP_URL` — Meme valeur que `NEXTAUTH_URL`

## Contribuer

### Structure du projet

```
src/
  app/
    (app)/          # Routes authentifiees (dashboard, projets, crm, etc.)
    api/            # Routes API (auth, widget, uploads)
    login/          # Page de connexion
    proposition/    # Pages publiques (propositions commerciales)
  components/       # Composants UI reutilisables (shadcn/ui)
  lib/              # Utilitaires (prisma, auth, roles, helpers)
  generated/        # Client Prisma genere (gitignored)
prisma/
  schema.prisma     # Schema de la base de donnees
public/
  widget.js         # Widget JS integrable sur les sites clients
  uploads/          # Fichiers uploades (gitignored)
```

### Conventions

- **Server Components** par defaut, `"use client"` uniquement quand necessaire
- **Server Actions** pour les mutations (fichiers `actions.ts` dans chaque route)
- Les `params` Next.js sont des `Promise` (Next.js 16) — toujours `await params`
- Prisma v7 : utiliser la syntaxe `connect` pour les relations dans `create()`
- Ne jamais utiliser `prisma db push` — modifier le schema puis `npx prisma generate`
- Les modifications de schema en production se font via des scripts SQL manuels

### Workflow

1. Creer une branche depuis `main`
2. Faire les modifications
3. Verifier que le build passe : `npm run build`
4. Creer une PR

### Roles utilisateurs

| Role | Acces |
|------|-------|
| `admin` | Acces complet + administration |
| `equipe` | Dashboard, projets, CRM, finance, tickets, timetracking |
| `client` | Espace client uniquement (projets, factures) |
