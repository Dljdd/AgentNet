FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies with the full monorepo context so workspace:* links resolve.
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./

# Copy only the packages needed to build mcp-server and its workspace deps.
COPY packages/mcp-server/package.json   ./packages/mcp-server/
COPY packages/config/package.json       ./packages/config/
COPY packages/core/package.json         ./packages/core/
COPY packages/types/package.json        ./packages/types/
COPY packages/agents/worker/package.json ./packages/agents/worker/

RUN pnpm install --frozen-lockfile --filter @agentnet/mcp-server...

# Copy source and build.
COPY packages/mcp-server/src   ./packages/mcp-server/src
COPY packages/mcp-server/tsconfig.json ./packages/mcp-server/
COPY packages/config/src       ./packages/config/src
COPY packages/config/tsconfig.json ./packages/config/
COPY packages/core/src         ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/types/src        ./packages/types/src
COPY packages/types/tsconfig.json ./packages/types/
COPY packages/agents/worker/src ./packages/agents/worker/src
COPY packages/agents/worker/tsconfig.json ./packages/agents/worker/

# Build workspace deps first, then mcp-server.
RUN pnpm --filter @agentnet/types build && \
    pnpm --filter @agentnet/config build && \
    pnpm --filter @agentnet/core build && \
    pnpm --filter @agentnet/agents-worker build && \
    pnpm --filter @agentnet/mcp-server build

# ── Runtime image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=base /app/node_modules       ./node_modules
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/package.json        ./

# Copy only compiled dist directories.
COPY --from=base /app/packages/types/dist         ./packages/types/dist
COPY --from=base /app/packages/types/package.json  ./packages/types/package.json
COPY --from=base /app/packages/config/dist        ./packages/config/dist
COPY --from=base /app/packages/config/package.json ./packages/config/package.json
COPY --from=base /app/packages/core/dist          ./packages/core/dist
COPY --from=base /app/packages/core/package.json   ./packages/core/package.json
COPY --from=base /app/packages/agents/worker/dist           ./packages/agents/worker/dist
COPY --from=base /app/packages/agents/worker/package.json   ./packages/agents/worker/package.json
COPY --from=base /app/packages/mcp-server/dist         ./packages/mcp-server/dist
COPY --from=base /app/packages/mcp-server/package.json  ./packages/mcp-server/package.json

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

WORKDIR /app/packages/mcp-server
CMD ["node", "dist/index.js"]
