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
export declare function init(c: TelemetryConfig): void;
export declare function identify(id: string | null): void;
export declare function trackEvent(name: string, properties?: Record<string, unknown>): void;
export declare function trackError(error: Error | {
    message: string;
    stack?: string;
}, context?: Record<string, unknown>): void;
export declare function screen(name: string): void;
export declare function getUserId(): string | null;
export declare function getConfigOrNull(): TelemetryConfig | null;
//# sourceMappingURL=index.d.ts.map