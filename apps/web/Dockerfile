# syntax=docker/dockerfile:1
# Build a partir da raiz do monorepo: docker build -f apps/web/Dockerfile .
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS build
RUN corepack enable
WORKDIR /repo
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter web...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN pnpm --filter @cdc/contracts build && pnpm --filter web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
