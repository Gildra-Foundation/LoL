FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/lol/package.json apps/lol/
RUN npm ci --no-audit --no-fund
COPY packages/engine packages/engine
COPY apps/lol apps/lol
ARG SITE_URL=https://riftden.com
ARG PREVIEW=false
# Публичные настройки трекера Plausible: статические страницы пререндерятся при сборке,
# поэтому значения нужны и здесь. Пусто (staging, локальные сборки) — трекера нет.
ARG PLAUSIBLE_SCRIPT_URL=
ARG PLAUSIBLE_API_URL=
ARG PLAUSIBLE_SITE_DOMAIN=
ENV NEXT_PUBLIC_SITE_URL=$SITE_URL SITE_PREVIEW=$PREVIEW \
    PLAUSIBLE_SCRIPT_URL=$PLAUSIBLE_SCRIPT_URL PLAUSIBLE_API_URL=$PLAUSIBLE_API_URL PLAUSIBLE_SITE_DOMAIN=$PLAUSIBLE_SITE_DOMAIN
RUN npm run build -w @rift/lol

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/lol/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/lol/.next/static ./apps/lol/.next/static
COPY --from=build --chown=node:node /app/apps/lol/public ./apps/lol/public
RUN mkdir -p /app/apps/lol/.next/cache/images && chown node:node /app/apps/lol/.next/cache/images
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health.json').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/lol/server.js"]
