# Standalone API image. Build context: apps/api (from repo root: fly deploy --config fly.api.toml)
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS build
RUN apt-get update -qq && apt-get install -y --no-install-recommends python3 build-essential && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY prisma prisma/
RUN npx prisma generate
COPY tsconfig.json ./
COPY src src/
RUN npm run build

FROM base AS runner
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
