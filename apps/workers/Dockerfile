# Builds the workers from the monorepo root:
#   docker build -f apps/workers/Dockerfile -t handsup-workers .
# Railway uses this file through apps/workers/railway.json.
ARG NODE_IMAGE=node:20-slim
FROM ${NODE_IMAGE}
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile --filter @handsup/workers... \
 && pnpm --filter @handsup/workers build
ENV NODE_ENV=production
# The local AI models download here on first start (~90 MB). Mount a volume at /app/.cache to keep them between deploys.
ENV MODELS_CACHE_DIR=/app/.cache/models
CMD ["node", "apps/workers/dist/index.js"]
