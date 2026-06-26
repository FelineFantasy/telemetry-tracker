import { SDK_VERSION } from "./version.js";
export { SDK_VERSION };
export declare function getAnonymousId(): string;
export type TelemetryConfig = {
    ingestUrl: string;
    app: string;
    /** Project API key (`tt_live_<publicId>_<secret>`). Required in production ingest. */
    apiKey?: string;
    platform?: string;
    environment?: string;
    release?: string;
    /** Flush interval in ms. Default 5000. Set 0 to disable batching. */
    batchInterval?: number;
    /** Max queue size before flush. Default 10. */
    batchSize?: number;
};
export declare function getSessionId(): string | null;
/** End the current session and clear the in-memory session id. */
export declare function endSession(): void;
export declare function init(c: TelemetryConfig): void;
export declare function identify(id: string | null): void;
/** Headers for ingest POST requests (Authorization + Content-Type). */
export declare function buildIngestHeaders(cfg: Pick<TelemetryConfig, "apiKey">): Record<string, string>;
export declare function trackEvent(name: string, properties?: Record<string, unknown>): void;
export declare function trackError(error: Error | {
    message: string;
    stack?: string;
}, context?: Record<string, unknown>): void;
export declare function screen(name: string): void;
export declare function getUserId(): string | null;
export declare function getConfigOrNull(): TelemetryConfig | null;
//# sourceMappingURL=index.d.ts.map