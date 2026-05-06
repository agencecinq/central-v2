# cinq-auto-resolve-worker

Service Node.js qui reçoit les webhooks `ticket.created` de CinqCentral V2,
classifie les tickets (codable / non-codable) puis — à terme — lance un agent
Claude Code pour ouvrir une PR.

Déployé sur **Render** aux côtés du service `cinq-central` (cf. `render.yaml`
à la racine du monorepo).

## Statut

**Phase 2 (classifier seul).** L'agent Claude Code n'est pas branché.
Pour les tickets classés `codable`, le worker termine en `skipped` avec un
`skip_reason` explicite jusqu'à la Phase 4.

## Setup local

```bash
cp .env.example .env.local
# remplir AUTORESOLVE_WEBHOOK_SECRET, AUTORESOLVE_INTERNAL_TOKEN, ANTHROPIC_API_KEY
# le secret webhook doit être identique à celui de CinqCentral V2

npm install
npm run dev          # tsx watch
npm test             # vitest
npm run typecheck
```

Redis local (BullMQ) :

```bash
docker run -d --name cinq-redis -p 6379:6379 redis:7-alpine
```

## Endpoints

- `GET  /health`
- `POST /webhooks/cinqcentral/ticket-created` — HMAC SHA-256 signé avec
  `AUTORESOLVE_WEBHOOK_SECRET`, header `x-cinqcentral-signature: sha256=<hex>`.

## Idempotence

Le `jobId` BullMQ est `ticket-{ticketId}`. Un même ticket ne sera donc traité
qu'une fois, même si le webhook arrive plusieurs fois ou que CinqCentral retry.

## Déploiement Render

Le worker fait partie du blueprint `render.yaml` à la racine du monorepo et
co-déploie 3 ressources :

| Service                       | Type      | Rôle                          |
|-------------------------------|-----------|-------------------------------|
| `cinq-auto-resolve-worker`    | web       | Le worker (Docker, ce dossier)|
| `cinq-auto-resolve-redis`     | keyvalue  | Backend BullMQ                |
| `cinq-central` (existant)     | web       | Émetteur webhook              |

Le service worker utilise le Dockerfile de ce dossier (qui ajoute `git` et
`gitleaks` en plus du runtime Node 20 alpine). `REDIS_URL` est injectée
automatiquement par Render via `fromService`.

Secrets à renseigner dans le dashboard Render (`sync: false`) :

- `AUTORESOLVE_WEBHOOK_SECRET` et `AUTORESOLVE_INTERNAL_TOKEN` — **mêmes
  valeurs des deux côtés** (cinq-central et worker)
- `CINQCENTRAL_BASE_URL` — URL publique de CinqCentral
- `ANTHROPIC_API_KEY`, `GITHUB_PAT`, `GITHUB_WEBHOOK_SECRET`, `SLACK_BOT_TOKEN`
