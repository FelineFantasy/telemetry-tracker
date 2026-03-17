const REPORTED = Symbol.for("telemetry.reported");
let config = null;
let userId = null;
let browserHandlersInstalled = false;
const DEFAULT_BATCH_INTERVAL = 5000;
const DEFAULT_BATCH_SIZE = 10;
const eventQueue = [];
let flushTimer = null;
function installBrowserErrorHandlers() {
    if (browserHandlersInstalled || typeof window === "undefined")
        return;
    browserHandlersInstalled = true;
    window.onerror = (message, source, lineno, colno, error) => {
        const cfg = getConfigOrNull();
        if (!cfg)
            return false;
        const err = error && error instanceof Error
            ? error
            : new Error(typeof message === "string" ? message : String(message));
        trackError(err, {
            source: "window.onerror",
            filename: source,
            lineno,
            colno,
        });
        return false; // let other handlers run
    };
    window.addEventListener("unhandledrejection", (event) => {
        const cfg = getConfigOrNull();
        if (!cfg)
            return;
        const reason = event.reason;
        const err = reason instanceof Error ? reason : new Error(reason != null ? String(reason) : "Unhandled rejection");
        trackError(err, { source: "unhandledrejection" });
    });
}
export function init(c) {
    config = { ...c };
    const interval = c.batchInterval ?? DEFAULT_BATCH_INTERVAL;
    if (interval > 0 && typeof setInterval !== "undefined") {
        flushTimer = setInterval(flushEvents, interval);
        const t = flushTimer;
        if (typeof t.unref === "function")
            t.unref();
    }
    installBrowserErrorHandlers();
}
export function identify(id) {
    userId = id;
}
function getConfig() {
    if (!config)
        throw new Error("telemetry-core: init() must be called first");
    return config;
}
function ensureUrl(url) {
    const base = getConfig().ingestUrl.replace(/\/$/, "");
    return `${base}${url}`;
}
async function send(path, body) {
    const cfg = getConfig();
    try {
        const res = await fetch(ensureUrl(path), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...body,
                app: cfg.app,
                platform: cfg.platform ?? undefined,
                environment: cfg.environment ?? undefined,
                release: cfg.release ?? undefined,
            }),
        });
        if (!res.ok) {
            console.warn("[telemetry] ingest failed:", res.status, await res.text());
        }
    }
    catch (e) {
        console.warn("[telemetry] send error:", e);
    }
}
function flushEvents() {
    const cfg = getConfigOrNull();
    if (!cfg || eventQueue.length === 0)
        return;
    const batch = eventQueue.splice(0, eventQueue.length);
    const base = cfg.ingestUrl.replace(/\/$/, "");
    const events = batch.map((e) => ({
        app: cfg.app,
        platform: cfg.platform,
        environment: cfg.environment,
        release: cfg.release,
        name: e.name,
        user_id: e.user_id ?? undefined,
        session_id: e.session_id,
        properties: e.properties,
    }));
    fetch(`${base}/ingest/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
    }).catch((e) => console.warn("[telemetry] batch send error:", e));
}
export function trackEvent(name, properties) {
    const cfg = getConfigOrNull();
    const interval = cfg?.batchInterval ?? DEFAULT_BATCH_INTERVAL;
    const batchSize = cfg?.batchSize ?? DEFAULT_BATCH_SIZE;
    const item = {
        name,
        user_id: userId,
        session_id: undefined,
        properties: properties ?? undefined,
    };
    if (interval > 0 && typeof setInterval !== "undefined") {
        eventQueue.push(item);
        if (eventQueue.length >= batchSize)
            flushEvents();
    }
    else {
        send("/ingest/event", {
            name: item.name,
            user_id: item.user_id ?? undefined,
            session_id: item.session_id,
            properties: item.properties,
        }).catch(() => { });
    }
}
export function trackError(error, context) {
    if (!getConfigOrNull())
        return;
    const err = error instanceof Error ? error : { message: error.message, stack: error.stack };
    if (err && typeof err === "object" && err[REPORTED])
        return;
    const message = err instanceof Error ? err.message : err.message;
    const stack = err instanceof Error ? err.stack : err.stack;
    if (err instanceof Error)
        err[REPORTED] = true;
    send("/ingest/error", {
        message,
        stack: stack ?? undefined,
        context: context ?? undefined,
        user_id: userId ?? undefined,
        session_id: undefined,
    }).catch(() => { });
}
export function screen(name) {
    trackEvent("$screen", { name });
}
export function getUserId() {
    return userId;
}
export function getConfigOrNull() {
    return config;
}
