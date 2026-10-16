# The game server (server/ and shared/), run by Node with tsx, as a user without rights.
# Built from the repository root: docker compose does it (see compose.yaml).
FROM node:22.23.2-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so they are rebuilt only when a package file changes.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false && npm cache clean --force

COPY shared/src shared/src
COPY server/src server/src
COPY server/drizzle server/drizzle

USER node
WORKDIR /app/server
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/index.ts"]
