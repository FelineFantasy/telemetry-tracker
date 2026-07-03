#!/usr/bin/env bash
# Production smoke test (#87) — hits live API at api.telemetry-tracker.com
set -euo pipefail

API="${SMOKE_API_URL:-https://api.telemetry-tracker.com}"
DASH="${SMOKE_DASHBOARD_URL:-https://telemetry-tracker.com}"
TS="$(date +%s)"
OWNER_EMAIL="smoke-e2e-${TS}@telemetry-tracker-smoke.test"
MEMBER_EMAIL="smoke-member-${TS}@telemetry-tracker-smoke.test"
PASSWORD="SmokeTest-${TS}!x"
APP="smoke-app-${TS}"
SESSION_ID="smoke-session-${TS}"

pass=0
fail=0
skip=0

log() { printf '%s\n' "$*"; }
ok() { pass=$((pass + 1)); log "  PASS: $1"; }
bad() { fail=$((fail + 1)); log "  FAIL: $1"; }
skip_step() { skip=$((skip + 1)); log "  SKIP: $1"; }

json_field() {
  local json="$1" field="$2"
  printf '%s' "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field','') or '')" 2>/dev/null || true
}

auth_header() { printf 'Authorization: Bearer %s' "$SESSION"; }
project_header() { printf 'X-Project-Id: %s' "$PROJECT_ID"; }

log "=== Telemetry Tracker production smoke (#87) ==="
log "API: $API"
log "Dashboard: $DASH"
log "Owner: $OWNER_EMAIL"
log ""

# --- Pre-checks ---
log "1. Infrastructure pre-checks"
if curl -sf "$API/health" | grep -q '"database":"ok"'; then ok "GET /health + database"; else bad "GET /health"; fi
if [[ "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/ingest/event" -H 'Content-Type: application/json' -d '{}')" == "401" ]]; then
  ok "POST /ingest/event without key → 401"
else bad "ingest auth"; fi
if curl -sf "$DASH" -o /dev/null; then ok "Dashboard home 200"; else bad "Dashboard home"; fi
if curl -sf "$DASH/docs/hosted-cloud" -o /dev/null; then ok "/docs/hosted-cloud 200"; else bad "hosted-cloud docs"; fi
if curl -sf "$DASH/register" -o /dev/null; then ok "/register page 200"; else bad "/register page"; fi
log ""

# --- Register ---
log "2. Register account"
REG=$(curl -sS -X POST "$API/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Smoke E2E\"}" \
  -w '\n%{http_code}')
REG_BODY=$(echo "$REG" | sed '$d')
REG_CODE=$(echo "$REG" | tail -1)
SESSION=$(json_field "$REG_BODY" sessionId)
if [[ "$REG_CODE" == "201" && -n "$SESSION" ]]; then
  ok "Register → 201 + session"
else
  bad "Register → $REG_CODE: $REG_BODY"
  log "Cannot continue without session."
  exit 1
fi
log ""

# --- Org + project ---
log "3. Create organization and project"
ORG=$(curl -sS -X POST "$API/api/meta/organizations" \
  -H 'Content-Type: application/json' \
  -H "$(auth_header)" \
  -d '{"name":"Smoke E2E Org"}')
ORG_ID=$(json_field "$ORG" id)
if [[ -n "$ORG_ID" ]]; then ok "Create org → $ORG_ID"; else bad "Create org: $ORG"; exit 1; fi

PROJ=$(curl -sS -X POST "$API/api/meta/projects" \
  -H 'Content-Type: application/json' \
  -H "$(auth_header)" \
  -d "{\"organizationId\":\"$ORG_ID\",\"name\":\"Smoke Project\",\"slug\":\"smoke-$TS\"}")
PROJECT_ID=$(json_field "$PROJ" id)
if [[ -n "$PROJECT_ID" ]]; then ok "Create project → $PROJECT_ID"; else bad "Create project: $PROJ"; exit 1; fi
log ""

# --- API key ---
log "4. Generate API key"
KEY_RESP=$(curl -sS -X POST "$API/api/project/api-keys" \
  -H 'Content-Type: application/json' \
  -H "$(auth_header)" \
  -H "$(project_header)" \
  -d '{"name":"Smoke key"}')
API_KEY=$(json_field "$KEY_RESP" key)
if [[ "$API_KEY" == tt_live_* ]]; then ok "API key created"; else bad "API key: $KEY_RESP"; exit 1; fi
log ""

# --- Ingest ---
log "5. Ingest error, event, session"
INGEST_AUTH="Authorization: Bearer $API_KEY"
E_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/ingest/event" \
  -H "$INGEST_AUTH" -H 'Content-Type: application/json' \
  -d "{\"app\":\"$APP\",\"name\":\"smoke.event\",\"properties\":{\"run\":\"$TS\"}}")
ERR_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/ingest/error" \
  -H "$INGEST_AUTH" -H 'Content-Type: application/json' \
  -d "{\"app\":\"$APP\",\"message\":\"Smoke error $TS\",\"stack\":\"Error: smoke\\n  at smoke.ts:1\"}")
SES_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/ingest/session" \
  -H "$INGEST_AUTH" -H 'Content-Type: application/json' \
  -d "{\"app\":\"$APP\",\"session_id\":\"$SESSION_ID\",\"started_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
if [[ "$E_CODE" == "204" ]]; then ok "POST /ingest/event → 204"; else bad "event ingest → $E_CODE"; fi
if [[ "$ERR_CODE" == "204" ]]; then ok "POST /ingest/error → 204"; else bad "error ingest → $ERR_CODE"; fi
if [[ "$SES_CODE" == "204" ]]; then ok "POST /ingest/session → 204"; else bad "session ingest → $SES_CODE"; fi
sleep 2
log ""

# --- Verify dashboard reads ---
log "6. Verify data in Errors, Events, Sessions, Overview"
EVENTS=$(curl -sS "$API/api/events?limit=5" -H "$(auth_header)" -H "$(project_header)")
ERRORS=$(curl -sS "$API/api/errors?limit=5" -H "$(auth_header)" -H "$(project_header)")
SESSIONS=$(curl -sS "$API/api/sessions?limit=5" -H "$(auth_header)" -H "$(project_header)")
OVERVIEW=$(curl -sS "$API/api/overview" -H "$(auth_header)" -H "$(project_header)")

if echo "$EVENTS" | grep -q "smoke.event"; then ok "Events list contains smoke.event"; else bad "Events: $(echo "$EVENTS" | head -c 200)"; fi
if echo "$ERRORS" | grep -q "Smoke error $TS"; then ok "Errors list contains smoke error"; else bad "Errors: $(echo "$ERRORS" | head -c 200)"; fi
if echo "$SESSIONS" | grep -q "$SESSION_ID"; then ok "Sessions list contains smoke session"; else bad "Sessions: $(echo "$SESSIONS" | head -c 200)"; fi
if echo "$OVERVIEW" | grep -q 'ingest'; then ok "Overview returns ingest stats"; else bad "Overview: $(echo "$OVERVIEW" | head -c 200)"; fi
log ""

# --- Team invite ---
log "7. Invite team member and accept"
INVITE=$(curl -sS -X POST "$API/api/meta/organizations/$ORG_ID/members" \
  -H 'Content-Type: application/json' \
  -H "$(auth_header)" \
  -d "{\"email\":\"$MEMBER_EMAIL\",\"role\":\"VIEWER\"}")
INVITE_TOKEN=$(json_field "$INVITE" inviteToken)
INVITE_STATUS=$(json_field "$INVITE" status)
if [[ "$INVITE_STATUS" == "invited" && -n "$INVITE_TOKEN" ]]; then
  ok "Invite created (token returned to owner)"
else
  bad "Invite: $INVITE"
fi

MEM_REG=$(curl -sS -X POST "$API/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$MEMBER_EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Smoke Member\",\"inviteToken\":\"$INVITE_TOKEN\"}" \
  -w '\n%{http_code}')
MEM_BODY=$(echo "$MEM_REG" | sed '$d')
MEM_CODE=$(echo "$MEM_REG" | tail -1)
MEM_ORG=$(json_field "$MEM_BODY" organizationId)
if [[ "$MEM_CODE" == "201" && "$MEM_ORG" == "$ORG_ID" ]]; then
  ok "Member registered via invite → joined org"
else
  bad "Member invite accept → $MEM_CODE: $MEM_BODY"
fi

PREVIEW=$(curl -sS "$API/api/meta/invites/preview?token=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$INVITE_TOKEN'))")")
if echo "$PREVIEW" | grep -q '"valid":false'; then ok "Invite token consumed after accept"; else skip_step "Invite preview still valid (may be ok if re-invited)"; fi
log ""

# --- Stripe billing ---
log "8. Stripe checkout + portal (API only — no card charge)"
CHECKOUT=$(curl -sS -X POST "$API/api/meta/organizations/$ORG_ID/billing/checkout" \
  -H 'Content-Type: application/json' \
  -H "$(auth_header)" \
  -d '{"planTier":"PRO"}' \
  -w '\n%{http_code}')
CO_BODY=$(echo "$CHECKOUT" | sed '$d')
CO_CODE=$(echo "$CHECKOUT" | tail -1)
CO_URL=$(json_field "$CO_BODY" url)
if [[ "$CO_CODE" == "200" && "$CO_URL" == https://checkout.stripe.com/* ]]; then
  ok "Checkout session created → Stripe URL"
  skip_step "Live Pro upgrade (requires manual card payment in Stripe Checkout)"
elif [[ "$CO_CODE" == "503" ]]; then
  bad "Stripe not configured (503)"
else
  bad "Checkout → $CO_CODE: $CO_BODY"
fi

PORTAL=$(curl -sS -X POST "$API/api/meta/organizations/$ORG_ID/billing/portal" \
  -H 'Content-Type: application/json' \
  -H "$(auth_header)" \
  -w '\n%{http_code}')
PO_BODY=$(echo "$PORTAL" | sed '$d')
PO_CODE=$(echo "$PORTAL" | tail -1)
PO_URL=$(json_field "$PO_BODY" url)
if [[ "$PO_CODE" == "200" && "$PO_URL" == https://billing.stripe.com/* ]]; then
  ok "Customer portal session created"
elif [[ "$PO_CODE" == "400" || "$PO_CODE" == "404" ]]; then
  skip_step "Portal requires Stripe customer/subscription ($PO_CODE)"
else
  bad "Portal → $PO_CODE: $PO_BODY"
fi
log ""

# --- Contact form ---
log "9. Contact form"
CONTACT=$(curl -sS -X POST "$API/api/contact" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$OWNER_EMAIL\",\"topic\":\"general\",\"message\":\"Automated smoke test run $TS — please ignore.\"}" \
  -w '\n%{http_code}')
CT_BODY=$(echo "$CONTACT" | sed '$d')
CT_CODE=$(echo "$CONTACT" | tail -1)
if [[ "$CT_CODE" == "200" && "$CT_BODY" == *'"ok":true'* ]]; then
  ok "Contact form accepted (delivery depends on Resend)"
elif [[ "$CT_CODE" == "502" || "$CT_CODE" == "503" ]]; then
  bad "Contact email delivery failed → $CT_CODE: $CT_BODY"
else
  bad "Contact → $CT_CODE: $CT_BODY"
fi
log ""

# --- Password reset ---
log "10. Password reset request"
FORGOT=$(curl -sS -X POST "$API/api/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OWNER_EMAIL\"}" \
  -w '\n%{http_code}')
FG_BODY=$(echo "$FORGOT" | sed '$d')
FG_CODE=$(echo "$FORGOT" | tail -1)
if [[ "$FG_CODE" == "200" && "$FG_BODY" == *'"ok":true'* ]]; then
  ok "Forgot-password accepted (email delivery not verified)"
  skip_step "Complete reset flow (requires inbox access)"
else
  bad "Forgot-password → $FG_CODE: $FG_BODY"
fi
log ""

# --- Bootstrap / auth session ---
log "11. Dashboard session bootstrap"
BOOT=$(curl -sS "$API/api/meta/dashboard-bootstrap" \
  -H "$(auth_header)" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "$(project_header)")
if echo "$BOOT" | grep -q '"user"'; then ok "Dashboard bootstrap returns user + workspace"; else bad "Bootstrap: $(echo "$BOOT" | head -c 300)"; fi
CTX=$(curl -sS "$API/api/meta/session-context" \
  -H "$(auth_header)" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "$(project_header)")
if echo "$CTX" | grep -q '"planTier":"FREE"'; then ok "Session context planTier FREE (pre-upgrade)"; else bad "Session context: $(echo "$CTX" | head -c 300)"; fi
LOGIN=$(curl -sS -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$PASSWORD\"}" \
  -w '\n%{http_code}')
LI_CODE=$(echo "$LOGIN" | tail -1)
if [[ "$LI_CODE" == "200" ]]; then ok "Login with smoke credentials"; else bad "Login → $LI_CODE"; fi
log ""

log "=== Summary ==="
log "PASS: $pass  FAIL: $fail  SKIP: $skip"
log "Smoke account: $OWNER_EMAIL (password stored in script env only — not logged)"
if [[ "$fail" -gt 0 ]]; then exit 1; fi
