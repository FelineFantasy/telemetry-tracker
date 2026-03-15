import { init as coreInit, identify, trackEvent, trackError as coreTrackError, screen as coreScreen, getConfigOrNull, } from "telemetry-core";
const g = typeof globalThis !== "undefined" ? globalThis : undefined;
const ErrorUtils = g != null && typeof g.ErrorUtils !== "undefined"
    ? g.ErrorUtils
    : undefined;
let sessionId = null;
function generateSessionId() {
    return `rn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
async function sendSession(endedAt) {
    const cfg = getConfigOrNull();
    if (!cfg || !sessionId)
        return;
    const base = cfg.ingestUrl.replace(/\/$/, "");
    try {
        await fetch(`${base}/ingest/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_id: sessionId,
                app: cfg.app,
                platform: cfg.platform ?? "react-native",
                user_id: undefined,
                started_at: new Date().toISOString(),
                ended_at: endedAt?.toISOString() ?? undefined,
            }),
        });
    }
    catch (_) { }
}
export function init(config) {
    coreInit(config);
    sessionId = generateSessionId();
    sendSession().catch(() => { });
    if (ErrorUtils?.setGlobalHandler) {
        ErrorUtils.setGlobalHandler((error) => {
            coreTrackError(error, { source: "globalHandler" });
        });
    }
}
export { identify, trackEvent, coreTrackError as trackError, coreScreen as screen };
export function getSessionId() {
    return sessionId;
}
export function endSession() {
    if (sessionId) {
        sendSession(new Date()).catch(() => { });
        sessionId = null;
    }
}
export function trackScreen(name) {
    coreScreen(name);
}
