# Node LTS base image (pinned to Node 22 LTS — bump intentionally)
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN corepack enable && yarn install --frozen-lockfile

# Copy source and build
COPY apps/web/ ./apps/web/
RUN yarn workspace web build

# --- Production image ---
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_PORT=4000

COPY --from=builder /app/apps/web/.output ./.output

EXPOSE 4000

USER node

CMD ["node", ".output/server/index.mjs"]
