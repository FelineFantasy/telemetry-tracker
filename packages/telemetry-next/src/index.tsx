"use client";

import React from "react";
import {
  init as coreInit,
  shutdown as coreShutdown,
  identify,
  trackEvent as coreTrackEvent,
  trackError as coreTrackError,
  screen as coreScreen,
  getSessionId,
  endSession,
  type TelemetryConfig,
} from "@telemetry-tracker/core";

let initialized = false;

export type TelemetryNextConfig = TelemetryConfig;

export function init(config: TelemetryNextConfig): void {
  coreInit(config);
  initialized = true;
  if (typeof window !== "undefined") {
    (window as unknown as { __telemetry_initialized?: boolean }).__telemetry_initialized = true;
  }
}

export function shutdown(): void {
  coreShutdown();
  initialized = false;
  if (typeof window !== "undefined") {
    (window as unknown as { __telemetry_initialized?: boolean }).__telemetry_initialized = false;
  }
}

export {
  identify,
  coreTrackEvent as trackEvent,
  coreScreen as screen,
  getSessionId,
  endSession,
};

export function trackError(error: Error, context?: Record<string, unknown>): void {
  coreTrackError(error, context);
}

export function useTelemetryRouter(pathname: string): void {
  if (typeof window === "undefined" || !initialized) return;
  coreScreen(pathname || "/");
}

type ErrorBoundaryProps = { children: React.ReactNode; fallback?: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean };

export class TelemetryErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    try {
      coreTrackError(error, { boundary: "TelemetryErrorBoundary" });
    } catch (_) {}
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.props.fallback) return this.props.fallback;
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function TelemetryProvider({
  config,
  children,
}: {
  config: TelemetryNextConfig;
  children: React.ReactNode;
}) {
  // Layout effect so init/session exist before child useEffects (e.g. useTrackPage).
  React.useLayoutEffect(() => {
    init(config);
    return () => {
      shutdown();
    };
  }, [config.ingestUrl, config.app]);
  return <>{children}</>;
}

export function useTrackPage(pathname: string): void {
  React.useEffect(() => {
    if (typeof window === "undefined" || !initialized) return;
    coreScreen(pathname || "/");
  }, [pathname]);
}
