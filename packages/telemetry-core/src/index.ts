const REPORTED = Symbol.for("telemetry.reported");

import { SDK_VERSION } from "./version.js";

export { SDK_VERSION };

const ANON_STORAGE_KEY = "tacko_telemetry_anon_id";

let anonymousId: string | null = null;

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAnonymousId(): string {
  if (anonymousId) return anonymousId;
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(ANON_STORAGE_KEY);
      if (stored) {
        anonymousId = stored;
        return anonymousId;
      }
    } catch (_) {}
  }
  anonymousId = generateUUID();
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(ANON_STORAGE_KEY, anonymousId);
    } catch (_) {}
  }
  return anonymousId;
}

export type TelemetryConfig = {
  ingestUrl: string;
  app: string;
  platform?: string;
  environment?: string;
  release?: string;
  /** Flush interval in ms. Default 5000. Set 0 to disable batching. */
  batchInterval?: number;
  /** Max queue size before flush. Default 10. */
  batchSize?: number;
};

let config: TelemetryConfig | null = null;
let userId: string | null = null;
let browserHandlersInstalled = false;

const DEFAULT_BATCH_INTERVAL = 5000;
const DEFAULT_BATCH_SIZE = 10;

type QueuedEvent = {
  name: string;
  user_id: string | null;
  session_id: string | undefined;
  properties?: Record<string, unknown>;
};
const eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/** Only install in real browser environments; skip in React Native / Node even if `window` is polyfilled. */
function installBrowserErrorHandlers(): void {
  if (browserHandlersInstalled) return;
  if (
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  )
    return;
  browserHandlersInstalled = true;

  window.onerror = (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ): boolean => {
    const cfg = getConfigOrNull();
    if (!cfg) return false;
    const err =
      error && error instanceof Error
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

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent): void => {
    const cfg = getConfigOrNull();
    if (!cfg) return;
    const reason = event.reason;
    const err =
      reason instanceof Error ? reason : new Error(reason != null ? String(reason) : "Unhandled rejection");
    trackError(err, { source: "unhandledrejection" });
  });
}

export function init(c: TelemetryConfig): void {
  config = { ...c };
  getAnonymousId(); // ensure anonymous id exists and is persisted (browser) or set in memory (Node)
  const interval = c.batchInterval ?? DEFAULT_BATCH_INTERVAL;
  if (interval > 0 && typeof setInterval !== "undefined") {
    flushTimer = setInterval(flushEvents, interval);
    const t = flushTimer as unknown as { unref?: () => void };
    if (typeof t.unref === "function") t.unref();
  }
  installBrowserErrorHandlers();
}

export function identify(id: string | null): void {
  userId = id;
}

function getConfig(): TelemetryConfig {
  if (!config) throw new Error("telemetry-core: init() must be called first");
  return config;
}

function ensureUrl(url: string): string {
  const base = getConfig().ingestUrl.replace(/\/$/, "");
  return `${base}${url}`;
}

async function send(path: string, body: Record<string, unknown>): Promise<void> {
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
        anonymous_id: getAnonymousId(),
        sdk_version: SDK_VERSION,
      }),
    });
    if (!res.ok) {
      console.warn("[telemetry] ingest failed:", res.status, await res.text());
    }
  } catch (e) {
    console.warn("[telemetry] send error:", e);
  }
}

function flushEvents(): void {
  const cfg = getConfigOrNull();
  if (!cfg || eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, eventQueue.length);
  const base = cfg.ingestUrl.replace(/\/$/, "");
  const anonId = getAnonymousId();
  const events = batch.map((e) => ({
    app: cfg.app,
    platform: cfg.platform,
    environment: cfg.environment,
    release: cfg.release,
    name: e.name,
    user_id: e.user_id ?? undefined,
    session_id: e.session_id,
    anonymous_id: anonId,
    sdk_version: SDK_VERSION,
    properties: e.properties,
  }));
  fetch(`${base}/ingest/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  }).catch((e) => console.warn("[telemetry] batch send error:", e));
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  const cfg = getConfigOrNull();
  const interval = cfg?.batchInterval ?? DEFAULT_BATCH_INTERVAL;
  const batchSize = cfg?.batchSize ?? DEFAULT_BATCH_SIZE;
  const item: QueuedEvent = {
    name,
    user_id: userId,
    session_id: undefined,
    properties: properties ?? undefined,
  };
  if (interval > 0 && typeof setInterval !== "undefined") {
    eventQueue.push(item);
    if (eventQueue.length >= batchSize) flushEvents();
  } else {
    send("/ingest/event", {
      name: item.name,
      user_id: item.user_id ?? undefined,
      session_id: item.session_id,
      properties: item.properties,
    }).catch(() => {});
  }
}

export function trackError(
  error: Error | { message: string; stack?: string },
  context?: Record<string, unknown>
): void {
  if (!getConfigOrNull()) return;
  const err = error instanceof Error ? error : { message: error.message, stack: error.stack };
  if (err && typeof err === "object" && (err as unknown as Record<symbol, boolean>)[REPORTED]) return;
  const message = err instanceof Error ? err.message : err.message;
  const stack = err instanceof Error ? err.stack : err.stack;
  if (err instanceof Error) (err as unknown as Record<symbol, boolean>)[REPORTED] = true;
  send("/ingest/error", {
    message,
    stack: stack ?? undefined,
    context: context ?? undefined,
    user_id: userId ?? undefined,
    session_id: undefined,
  }).catch(() => {});
}

export function screen(name: string): void {
  trackEvent("$screen", { name });
}

export function getUserId(): string | null {
  return userId;
}

export function getConfigOrNull(): TelemetryConfig | null {
  return config;
}
