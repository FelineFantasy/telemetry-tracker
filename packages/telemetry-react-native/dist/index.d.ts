import { identify, trackEvent, trackError as coreTrackError, screen as coreScreen, type TelemetryConfig } from "telemetry-core";
export type TelemetryReactNativeConfig = TelemetryConfig & {
    app: string;
    platform?: string;
};
export declare function init(config: TelemetryReactNativeConfig): void;
export { identify, trackEvent, coreTrackError as trackError, coreScreen as screen };
export declare function getSessionId(): string | null;
export declare function endSession(): void;
export declare function trackScreen(name: string): void;
