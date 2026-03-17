import { identify, trackEvent, trackError as coreTrackError, type TelemetryConfig } from "@tacko/telemetry-core";
export type TelemetryNodeConfig = TelemetryConfig & {
    app: string;
    platform?: string;
};
export declare function init(config: TelemetryNodeConfig): void;
export { identify, trackEvent, coreTrackError as trackError };
export declare function getConfig(): TelemetryConfig | null;
export declare function middleware(opts?: {
    trackRequestBody?: boolean;
}): (req: {
    method?: string;
    url?: string;
    body?: unknown;
}, _res: unknown, next: () => void) => void;
