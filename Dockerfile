# Dashboard image — build context must be repo root (packages/, pnpm workspace, root eslint.config.mjs).
# Railway dashboard service: Root Directory = empty, Build → Dockerfile path = this file. Do not use for API.
# syntax = docker/dockerfile:1

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y python-is-python3 build-essential pkg-config && \
    rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/telemetry-core/package.json packages/telemetry-core/package.json
COPY packages/telemetry-next/package.json packages/telemetry-next/package.json

RUN pnpm install --frozen-lockfile

COPY apps apps
COPY packages packages
COPY eslint.config.mjs ./eslint.config.mjs

RUN pnpm --filter dashboard build

FROM base AS runner

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/telemetry-core/package.json packages/telemetry-core/package.json
COPY packages/telemetry-next/package.json packages/telemetry-next/package.json

RUN pnpm install --frozen-lockfile --prod=false

COPY --from=build /app/apps apps
COPY --from=build /app/packages packages

WORKDIR /app/apps/dashboard

EXPOSE 3000

CMD ["pnpm", "start"]
