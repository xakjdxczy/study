#!/usr/bin/env bash
# Publish the static textbook to the VPS under /study/.
# Secrets: SSH_PRIVATE_KEY, SSH_HOST (IP, hostname, or http(s) URL).
# Login user is root unless SSH_USER is set.
set -euo pipefail

normalize_host() {
  local h="${1:-}"
  h="${h#"${h%%[![:space:]]*}"}"
  h="${h%"${h##*[![:space:]]}"}"
  h="${h#http://}"
  h="${h#https://}"
  h="${h%%/*}"
  if [[ "$h" == \[* ]]; then
    h="${h#\[}"
    h="${h%%]*}"
  else
    h="${h%%:*}"
  fi
  printf '%s' "$h"
}

HOST="$(normalize_host "${SSH_HOST:-117.72.108.246}")"
USER="${SSH_USER:-root}"
REMOTE_DIR="${SSH_REMOTE_DIR:-/var/www/study}"
KEY_FILE="${SSH_KEY_FILE:-}"

if [[ -z "$HOST" ]]; then
  echo "Need SSH_HOST (bare IP/hostname, or an http(s) URL)" >&2
  exit 1
fi

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

SSH=(ssh -i "$KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
SCP=(scp -i "$KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

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
