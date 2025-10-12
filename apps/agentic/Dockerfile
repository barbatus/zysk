# syntax=docker/dockerfile:1.6
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./

COPY apps/agentic/ ./apps/agentic/
COPY apps/cube/ ./apps/cube/

COPY packages/db/ ./packages/db/
COPY packages/scraper/ ./packages/scraper/
COPY packages/services/ ./packages/services/
COPY packages/shared/ ./packages/shared/
COPY packages/ts-rest/ ./packages/ts-rest/
COPY packages/config-typescript/ ./packages/config-typescript/

RUN pnpm install --frozen-lockfile

# Build the agentic app
WORKDIR /app/apps/agentic
RUN pnpm run build

# Runtime stage
FROM node:20-slim AS runtime

# Install CA certificates for TLS connections
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/agentic/node_modules ./apps/agentic/node_modules
COPY --from=builder /app/apps/agentic/dist ./apps/agentic/dist
COPY --from=builder /app/apps/agentic/package.json ./apps/agentic/package.json

# Copy workspace packages
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/scraper ./packages/scraper
COPY --from=builder /app/packages/services ./packages/services
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/ts-rest ./packages/ts-rest
COPY --from=builder /app/apps/cube ./apps/cube

WORKDIR /app/apps/agentic

CMD ["node", "dist/worker.js"]
