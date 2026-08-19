#!/usr/bin/env bash
# Publish the static textbook to the cloud server under /study/.
set -euo pipefail

HOST="${SSH_HOST:-117.72.108.246}"
USER="${SSH_USER:-root}"
REMOTE_DIR="${SSH_REMOTE_DIR:-/var/www/study}"
KEY_FILE="${SSH_KEY_FILE:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$KEY_FILE" ]]; then
  KEY_FILE="$(mktemp)"
  cleanup() { rm -f "$KEY_FILE"; }
  trap cleanup EXIT
  if [[ -n "${SSH_PRIVATE_KEY:-}" ]]; then
    printf '%s\n' "$SSH_PRIVATE_KEY" > "$KEY_FILE"
  elif [[ -f "${HOME}/.ssh/id_ed25519" ]]; then
    cp "${HOME}/.ssh/id_ed25519" "$KEY_FILE"
  else
    echo "Need SSH_PRIVATE_KEY or SSH_KEY_FILE" >&2
    exit 1
  fi
  chmod 600 "$KEY_FILE"
fi

SSH=(ssh -i "$KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=15)
SCP=(scp -i "$KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=15)

"${SSH[@]}" "${USER}@${HOST}" "mkdir -p '${REMOTE_DIR}/js'"
"${SCP[@]}" \
  "$ROOT/index.html" \
  "$ROOT/styles.css" \
  "${USER}@${HOST}:${REMOTE_DIR}/"
"${SCP[@]}" -r \
  "$ROOT/js/." \
  "${USER}@${HOST}:${REMOTE_DIR}/js/"
"${SSH[@]}" "${USER}@${HOST}" "chown -R www-data:www-data '${REMOTE_DIR}'"

echo "Published https://${HOST}/study/"
