# Stage 1: Dependencies & Prisma Generation
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL required by Prisma engine
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

# Stage 2: Minimal Production Runner
FROM node:20-slim AS runner

WORKDIR /app

# Install runtime OpenSSL and curl for container health checks
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Copy installed production node_modules and generated Prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src/
COPY routes ./routes/
COPY middleware ./middleware/
COPY validations ./validations/
COPY utils ./utils/
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Prepare directories and non-root user permissions
RUN chmod +x ./docker-entrypoint.sh && mkdir -p logs uploads && chown -R node:node logs uploads

USER node

EXPOSE 5000

# Health check verifies the HTTP server root endpoint responds with 200 OK
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
