# Node LTS base image (pinned to Node 22 LTS — bump intentionally)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY app/api/package.json ./app/api/
COPY app/web/package.json ./app/web/

RUN corepack enable && yarn install --frozen-lockfile

# Copy source and build
COPY app/web/ ./app/web/
RUN yarn workspace web build

# --- Production image ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_PORT=4000

COPY --from=builder /app/app/web/.output ./.output

EXPOSE 4000

USER node

CMD ["node", ".output/server/index.mjs"]
