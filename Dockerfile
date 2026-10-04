# Сайт Rift Codex (apps/lol) вместе с движком из подмодуля packages/engine.
# Сборка: docker build -t riftden-web --build-arg SITE_URL=https://riftden.com .
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/lol/package.json apps/lol/
RUN npm ci --no-audit --no-fund
COPY packages/engine packages/engine
COPY apps/lol apps/lol
# адрес сайта нужен при сборке: из него строятся канонические ссылки, Open Graph и sitemap
ARG SITE_URL=https://riftden.com
ENV NEXT_PUBLIC_SITE_URL=$SITE_URL
RUN npm run build -w @rift/lol

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start", "-w", "@rift/lol", "--", "-p", "3000", "-H", "0.0.0.0"]
