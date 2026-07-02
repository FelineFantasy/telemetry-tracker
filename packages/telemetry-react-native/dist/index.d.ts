import { identify, trackEvent, trackError as coreTrackError, screen as coreScreen, getSessionId, endSession, SDK_VERSION, type TelemetryConfig } from "@telemetry-tracker/core";
export type TelemetryReactNativeConfig = TelemetryConfig & {
    app: string;
    platform?: string;
};
export declare function init(config: TelemetryReactNativeConfig): void;
export { identify, trackEvent, coreTrackError as trackError, coreScreen as screen, getSessionId, endSession, SDK_VERSION, };
export declare function trackScreen(name: string): void;
