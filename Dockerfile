FROM node:24-trixie-slim AS deps

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile


FROM node:24-trixie-slim AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm build
RUN mkdir -p /app/logs


FROM gcr.io/distroless/nodejs24-debian13 AS runner

WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./
COPY --from=builder --chown=nonroot:nonroot /app/logs ./logs
USER nonroot
EXPOSE 8080
CMD ["dist/main.js"]