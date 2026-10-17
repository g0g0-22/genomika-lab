#!/bin/sh
# Decides whose X-Forwarded-For nginx may believe, before nginx starts.
#
# A request can only reach this container from outside through the platform's
# ingress, which joins one of the container's networks to do so. Peers on
# those networks are therefore proxies; anything else is a client speaking
# directly, whose X-Forwarded-For is whatever it chose to write. Extra ranges
# can be added with TRUSTED_PROXIES (space-separated CIDRs).
set -eu

out=/etc/nginx/snippets/trusted-proxies.conf
: > "$out"

for cidr in $(ip -o -f inet addr show | awk '$2 != "lo" { print $4 }'); do
  eval "$(ipcalc -n "$cidr")"            # sets NETWORK
  echo "set_real_ip_from ${NETWORK}/${cidr#*/};" >> "$out"
done
for cidr in ${TRUSTED_PROXIES:-}; do
  echo "set_real_ip_from ${cidr};" >> "$out"
done

echo "trusted-proxies: $(tr '\n' ' ' < "$out")"
