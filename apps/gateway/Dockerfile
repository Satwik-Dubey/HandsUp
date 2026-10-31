# Builds the gateway from the monorepo root:
#   docker build -f apps/gateway/Dockerfile -t handsup-gateway .
# Railway uses this file through apps/gateway/railway.json.
ARG NODE_IMAGE=node:20-slim
FROM ${NODE_IMAGE}
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile --filter @handsup/gateway... \
 && pnpm --filter @handsup/gateway build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/gateway/dist/index.js"]
