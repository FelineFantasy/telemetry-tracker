import React from "react";
import { identify, type TelemetryConfig } from "@tacko/telemetry-core";
export type TelemetryNextConfig = TelemetryConfig;
export declare function init(config: TelemetryNextConfig): void;
export { identify };
export declare function trackError(error: Error, context?: Record<string, unknown>): void;
export declare function useTelemetryRouter(pathname: string): void;
type ErrorBoundaryProps = {
    children: React.ReactNode;
    fallback?: React.ReactNode;
};
type ErrorBoundaryState = {
    hasError: boolean;
};
export declare class TelemetryErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(): ErrorBoundaryState;
    componentDidCatch(error: Error): void;
    render(): React.ReactNode;
}
export declare function TelemetryProvider({ config, children, }: {
    config: TelemetryNextConfig;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useTrackPage(pathname: string): void;
