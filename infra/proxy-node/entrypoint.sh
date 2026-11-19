#!/bin/sh
set -eu

AUTH_USER="${PROXY_AUTH_USER:?PROXY_AUTH_USER must be set}"
AUTH_PASS="${PROXY_AUTH_PASS:?PROXY_AUTH_PASS must be set}"
PORT="${PROXY_PORT:-443}"
TLS_ENABLED="${PROXY_TLS_ENABLED:-true}"

if [ "$TLS_ENABLED" = "true" ]; then
  CERT="${TLS_CERT_PATH:-/certs/fullchain.pem}"
  KEY="${TLS_KEY_PATH:-/certs/privkey.pem}"
  if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    echo "ERROR: TLS_ENABLED=true but cert/key missing at $CERT and $KEY" >&2
    exit 1
  fi
  echo "Starting authenticated HTTPS (TLS) proxy on :$PORT"
  exec /bin/gost -L "http+tls://${AUTH_USER}:${AUTH_PASS}@:${PORT}?cert=${CERT}&key=${KEY}"
else
  echo "Starting local development authenticated HTTP CONNECT proxy on :$PORT"
  exec /bin/gost -L "http://${AUTH_USER}:${AUTH_PASS}@:${PORT}"
fi
