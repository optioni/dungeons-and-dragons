# Node LTS base image (pinned to Node 22 LTS — bump intentionally)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/api/package.json ./apps/api/
# apps/web/package.json is needed for workspace resolution
COPY apps/web/package.json ./apps/web/

RUN corepack enable && yarn install --frozen-lockfile

# Copy source and compile
COPY apps/api/ ./apps/api/
RUN yarn workspace api build

# --- Production image ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy dependency manifests for production install
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN corepack enable && yarn workspaces focus api --production

# Copy compiled output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

USER node

CMD ["node", "apps/api/dist/src/main"]
