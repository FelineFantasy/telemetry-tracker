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

export function init(c: TelemetryConfig): void {
  config = { ...c };
  const interval = c.batchInterval ?? DEFAULT_BATCH_INTERVAL;
  if (interval > 0 && typeof setInterval !== "undefined") {
    flushTimer = setInterval(flushEvents, interval);
    const t = flushTimer as unknown as { unref?: () => void };
    if (typeof t.unref === "function") t.unref();
  }
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
  const message = error instanceof Error ? error.message : error.message;
  const stack = error instanceof Error ? error.stack : error.stack;
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
