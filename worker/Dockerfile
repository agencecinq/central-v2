FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` honors optional deps — required because @anthropic-ai/claude-agent-sdk
# ships its native CLI binaries (one per platform) as optionalDependencies.
# Stripping them with --omit=optional leaves the SDK unable to spawn the agent.
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# git: required by simple-git for cloning
# gitleaks: pre-commit secret scanner (spec §7.5) — fetched from the
# official GitHub release. Alpine apk doesn't ship gitleaks in its main
# repo, and the official binary is glibc-linked (incompatible with musl),
# so the runtime image is Debian-based.
ARG GITLEAKS_VERSION=8.21.4
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates curl \
  && curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
     | tar -xz -C /usr/local/bin gitleaks \
  && apt-get purge -y --auto-remove curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
