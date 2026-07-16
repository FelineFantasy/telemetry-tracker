/**
 * Optional client-side PII scrubbing for @telemetry-tracker/core.
 * Complements server ingest scrubbing; never replaces it.
 */
export type ClientPiiScrubOptions = {
    denyKeys?: string[];
    maxDepth?: number;
    maxNodes?: number;
};
/** Scrub PII patterns in free-form text. Preserves newlines. */
export declare function scrubPiiText(text: string): string;
export declare function scrubPiiValue(value: unknown, options?: ClientPiiScrubOptions): unknown;
export declare function scrubPiiRecord(record: Record<string, unknown> | undefined, options?: ClientPiiScrubOptions): Record<string, unknown> | undefined;
//# sourceMappingURL=pii-scrub.d.ts.map