#!/usr/bin/env bash
# External uptime probe for hosted production (#93).
# Exits 0 when API /health and dashboard are healthy; non-zero on failure.
# Used by .github/workflows/production-uptime.yml and external monitors (UptimeRobot, etc.).
set -euo pipefail

API="${UPTIME_API_URL:-https://api.telemetry-tracker.com}"
DASH="${UPTIME_DASHBOARD_URL:-https://telemetry-tracker.com}"
MAX_DB_LATENCY_MS="${UPTIME_MAX_DB_LATENCY_MS:-5000}"

fail() {
  printf 'UPTIME FAIL: %s\n' "$1" >&2
  exit 1
}

http_code() {
  curl -sS -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || echo "000"
}

HEALTH_CODE=$(http_code "$API/health")
HEALTH=$(curl -sS "$API/health" 2>/dev/null || true)

if [[ "$HEALTH_CODE" == "000" || -z "$HEALTH" ]]; then
  fail "GET $API/health unreachable"
fi
if [[ "$HEALTH_CODE" != "200" ]]; then
  fail "GET $API/health → $HEALTH_CODE — $HEALTH"
fi
if ! echo "$HEALTH" | grep -q '"ok":true'; then
  fail "GET $API/health ok:false — $HEALTH"
fi
if ! echo "$HEALTH" | grep -q '"database":"ok"'; then
  fail "GET $API/health database not ok — $HEALTH"
fi

DB_MS=$(echo "$HEALTH" | sed -n 's/.*"database_latency_ms":\([0-9]*\).*/\1/p')
if [[ -n "$DB_MS" && "$DB_MS" -gt "$MAX_DB_LATENCY_MS" ]]; then
  fail "database_latency_ms=${DB_MS} exceeds UPTIME_MAX_DB_LATENCY_MS=${MAX_DB_LATENCY_MS}"
fi

DASH_CODE=$(http_code "$DASH")
if [[ "$DASH_CODE" != "200" ]]; then
  fail "GET $DASH → $DASH_CODE (expected 200)"
fi

INGEST_CODE=$(http_code -X POST "$API/ingest/event" -H 'Content-Type: application/json' -d '{"app":"uptime","name":"probe"}')
if [[ "$INGEST_CODE" != "401" ]]; then
  fail "POST $API/ingest/event without key → $INGEST_CODE (expected 401 — auth may be misconfigured)"
fi

printf 'UPTIME OK: api=%s dashboard=%s db_latency_ms=%s\n' "$API" "$DASH" "${DB_MS:-unknown}"
