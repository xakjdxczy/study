#!/usr/bin/env bash
# Publish the static textbook and mini-games to the cloud server under /study/.
# Also (re)starts the Eggy Party websocket on 127.0.0.1:3011 behind /study/eggy/ws.
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

"${SSH[@]}" "${USER}@${HOST}" "mkdir -p '${REMOTE_DIR}/js' '${REMOTE_DIR}/ski' '${REMOTE_DIR}/eggy'"
"${SCP[@]}" \
  "$ROOT/index.html" \
  "$ROOT/styles.css" \
  "${USER}@${HOST}:${REMOTE_DIR}/"
"${SCP[@]}" -r \
  "$ROOT/js/." \
  "${USER}@${HOST}:${REMOTE_DIR}/js/"
if [[ -d "$ROOT/ski" ]]; then
  "${SCP[@]}" \
    "$ROOT/ski/index.html" \
    "$ROOT/ski/styles.css" \
    "$ROOT/ski/game.js" \
    "${USER}@${HOST}:${REMOTE_DIR}/ski/"
fi
"${SCP[@]}" \
  "$ROOT/eggy/index.html" \
  "$ROOT/eggy/styles.css" \
  "$ROOT/eggy/game.js" \
  "$ROOT/eggy/shared.js" \
  "$ROOT/eggy/server.js" \
  "$ROOT/eggy/package.json" \
  "${USER}@${HOST}:${REMOTE_DIR}/eggy/"
"${SCP[@]}" \
  "$ROOT/scripts/eggy-party.service" \
  "${USER}@${HOST}:/etc/systemd/system/eggy-party.service"

"${SSH[@]}" "${USER}@${HOST}" "bash -s" <<'REMOTE'
set -euo pipefail
# websocket location in both copies of the vhost
for f in /etc/nginx/sites-enabled/remotedesk /etc/nginx/sites-available/remotedesk; do
  [ -f "$f" ] || continue
  if ! grep -q "location /study/eggy/ws" "$f"; then
    python3 - "$f" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
text = p.read_text()
block = """
    # ---- eggy party websocket (do not remove) ----
    location /study/eggy/ws {
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

"""
needle = "    location = /study { return 302 /study/; }"
if needle not in text:
    raise SystemExit(f"cannot patch {p}: study location missing")
p.write_text(text.replace(needle, block + needle, 1))
print("patched", p)
PY
  fi
done
cd /var/www/study/eggy
npm install --omit=dev --no-fund --no-audit
chown -R www-data:www-data /var/www/study
nginx -t
systemctl daemon-reload
systemctl enable --now eggy-party
systemctl restart eggy-party
systemctl reload nginx
REMOTE

echo "Published https://${HOST}/study/"
echo "Ski game https://${HOST}/study/ski/"
echo "Eggy party https://${HOST}/study/eggy/"
