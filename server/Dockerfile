# syntax=docker/dockerfile:1

# ------------------------------------------------------------------- deps --
# better-sqlite3 is a native module and compiles from source, so this stage
# carries a toolchain the runtime stage does not.
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------- runtime --
FROM node:22-bookworm-slim AS runtime
# The laboratory's own time zone. "Today" for a booking and the wall-clock time
# of a seminar are Skopje ideas; left unset the container runs in UTC and every
# seeded event time shows an hour or two late.
ENV NODE_ENV=production \
    TZ=Europe/Skopje \
    PORT=4000 \
    DB_PATH=/data/genomika.db \
    UPLOAD_DIR=/data/uploads

WORKDIR /app
COPY --from=deps /build/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# All mutable state — the SQLite file and uploaded CVs — lives in /data and
# nowhere else, so rebuilding the image never destroys it. The entrypoint
# starts as root, gives /data to the node user and drops to it (see the script).
RUN mkdir -p /data && chown -R node:node /data /app
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
