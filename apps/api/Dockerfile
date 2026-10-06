# syntax=docker/dockerfile:1
# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS build
RUN corepack enable
WORKDIR /repo
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter api...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @cdc/contracts build \
 && pnpm --filter api build \
 && pnpm --filter api deploy --legacy --prod /out

FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3100 \
    LAWS_DIR=/app/data/laws
COPY --from=build --chown=node:node /out ./
COPY --chown=node:node data/laws ./data/laws
USER node
EXPOSE 3100
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
