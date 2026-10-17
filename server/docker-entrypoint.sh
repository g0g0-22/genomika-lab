#!/bin/sh
# /data is a bind mount of a folder in the deployment checkout. Docker creates
# that folder as root on the first start, which the unprivileged user the
# application runs as cannot write to. Start as root only long enough to hand
# the folder over, then drop to that user for the life of the process.
set -eu

mkdir -p /data "$UPLOAD_DIR"
chown -R node:node /data || echo "entrypoint: could not chown /data; continuing" >&2

exec setpriv --reuid=node --regid=node --init-groups "$@"
