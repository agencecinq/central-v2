# cinq-auto-resolve-worker

Service Node.js qui reçoit les webhooks `ticket.created` de CinqCentral V2,
classifie les tickets (codable / non-codable) puis — à terme — lance un agent
Claude Code pour ouvrir une PR.

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

## Déploiement Railway

```bash
railway link
railway up
```

Variables d'env à configurer dans Railway, plus le service Redis managé.
