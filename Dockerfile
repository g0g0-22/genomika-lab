# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- client ---
# Builds the React application into static files. Nothing from this stage
# except client/dist reaches the final image.
FROM node:22-bookworm-slim AS client-build
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------------------------------------------------------------- server ---
# better-sqlite3 is a native module, so this stage carries the toolchain that
# compiles it. The runtime stage below does not.
FROM node:22-bookworm-slim AS server-deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# --------------------------------------------------------------- runtime ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/data/genomika.db \
    UPLOAD_DIR=/data/uploads

WORKDIR /app

COPY --from=server-deps /build/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY --from=client-build /build/client/dist ./client/dist

# The writable state — SQLite file and uploaded CVs — lives only here, so a
# rebuild never destroys it.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
