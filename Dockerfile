FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate && pnpm build && chown -R node:node /app
USER node
ENV NODE_ENV=production HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "start", "--hostname", "0.0.0.0"]
