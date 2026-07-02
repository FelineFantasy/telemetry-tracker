import {
  init as coreInit,
  identify,
  trackEvent,
  trackError as coreTrackError,
  screen as coreScreen,
  getSessionId,
  endSession,
  SDK_VERSION,
  type TelemetryConfig,
} from "@telemetry-tracker/core";

const g = typeof globalThis !== "undefined" ? globalThis : undefined;
const ErrorUtils =
  g != null && typeof (g as unknown as { ErrorUtils?: unknown }).ErrorUtils !== "undefined"
    ? (g as unknown as { ErrorUtils: { setGlobalHandler?(h: (e: Error) => void): void } }).ErrorUtils
    : undefined;

export type TelemetryReactNativeConfig = TelemetryConfig & {
  app: string;
  platform?: string;
};

export function init(config: TelemetryReactNativeConfig): void {
  coreInit(config);

  if (ErrorUtils?.setGlobalHandler) {
    ErrorUtils.setGlobalHandler((error: Error) => {
      coreTrackError(error, { source: "globalHandler" });
    });
  }
}

export {
  identify,
  trackEvent,
  coreTrackError as trackError,
  coreScreen as screen,
  getSessionId,
  endSession,
  SDK_VERSION,
};

export function trackScreen(name: string): void {
  coreScreen(name);
}
