#!/usr/bin/env bash
# Runs the COMPASS backend (FastAPI) + frontend (Vite) together.
# Usage:
#   LLM_ENDPOINT="http://<vllm-host>:8000/v1/chat/completions" ./run-dev.sh
#   ./run-dev.sh http://<vllm-host>:8000/v1/chat/completions
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"

# LLM endpoint may come from arg 1 or env var
if [[ $# -ge 1 ]]; then
  export LLM_ENDPOINT="$1"
fi
if [[ -z "${LLM_ENDPOINT:-}" ]]; then
  echo "warning: LLM_ENDPOINT not set — backend will reject /api/analyze and /api/chat until you set it."
fi

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
LAN_IP="${LAN_IP:-127.0.0.1}"

export VITE_API_URL="${VITE_API_URL:-http://$LAN_IP:$BACKEND_PORT}"

echo "────────────────────────────────────────────────────────"
echo " Backend : http://$LAN_IP:$BACKEND_PORT   (also http://localhost:$BACKEND_PORT)"
echo " Frontend: http://$LAN_IP:$FRONTEND_PORT  (also http://localhost:$FRONTEND_PORT)"
echo " LLM     : ${LLM_ENDPOINT:-<unset>}"
echo "────────────────────────────────────────────────────────"

pids=()
cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

( cd "$BACKEND_DIR" && \
    python3 -m uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" ) &
pids+=($!)

( cd "$ROOT" && npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" ) &
pids+=($!)

wait -n
