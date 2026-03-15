import {
  init as coreInit,
  identify,
  trackEvent,
  trackError as coreTrackError,
  screen as coreScreen,
  getConfigOrNull,
  type TelemetryConfig,
} from "telemetry-core";

const g = typeof globalThis !== "undefined" ? globalThis : undefined;
const ErrorUtils =
  g != null && typeof (g as unknown as { ErrorUtils?: unknown }).ErrorUtils !== "undefined"
    ? (g as unknown as { ErrorUtils: { setGlobalHandler?(h: (e: Error) => void): void } }).ErrorUtils
    : undefined;

export type TelemetryReactNativeConfig = TelemetryConfig & {
  app: string;
  platform?: string;
};

let sessionId: string | null = null;

function generateSessionId(): string {
  return `rn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function sendSession(endedAt?: Date): Promise<void> {
  const cfg = getConfigOrNull();
  if (!cfg || !sessionId) return;
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
  } catch (_) {}
}

export function init(config: TelemetryReactNativeConfig): void {
  coreInit(config);
  sessionId = generateSessionId();
  sendSession().catch(() => {});

  if (ErrorUtils?.setGlobalHandler) {
    ErrorUtils.setGlobalHandler((error: Error) => {
      coreTrackError(error, { source: "globalHandler" });
    });
  }
}

export { identify, trackEvent, coreTrackError as trackError, coreScreen as screen };

export function getSessionId(): string | null {
  return sessionId;
}

export function endSession(): void {
  if (sessionId) {
    sendSession(new Date()).catch(() => {});
    sessionId = null;
  }
}

export function trackScreen(name: string): void {
  coreScreen(name);
}
