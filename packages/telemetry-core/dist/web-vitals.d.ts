/** Core Web Vitals capture for browser apps (issue #193). */
import type { Metric } from "web-vitals";
export declare const WEB_VITAL_EVENT_NAME = "$web_vital";
export type WebVitalMetricName = "LCP" | "INP" | "CLS" | "TTFB" | "FID";
export type WebVitalRating = "good" | "needs-improvement" | "poor";
export type WebVitalEventProperties = {
    metric: WebVitalMetricName;
    value: number;
    rating: WebVitalRating;
    path: string;
    id: string;
    navigation_type?: string;
    connection_type?: string;
};
export declare function rateWebVital(metric: WebVitalMetricName, value: number): WebVitalRating;
export declare function buildWebVitalProperties(metric: Metric): WebVitalEventProperties;
/** Register Core Web Vitals listeners; calls `report` once per finalized metric sample. */
export declare function installWebVitals(report: (properties: WebVitalEventProperties) => void): void;
/** @internal Test helper — reset install guard. */
export declare function resetWebVitalsInstallState(): void;
//# sourceMappingURL=web-vitals.d.ts.map