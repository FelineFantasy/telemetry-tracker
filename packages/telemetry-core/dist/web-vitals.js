/** Core Web Vitals capture for browser apps (issue #193). */
export const WEB_VITAL_EVENT_NAME = "$web_vital";
/** Google Web Vitals thresholds — used in tests and when rating is computed locally. */
const THRESHOLDS = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
    TTFB: [800, 1800],
    FID: [100, 300],
};
export function rateWebVital(metric, value) {
    const [goodMax, poorMin] = THRESHOLDS[metric];
    if (value <= goodMax)
        return "good";
    if (value >= poorMin)
        return "poor";
    return "needs-improvement";
}
function readPagePath() {
    if (typeof window === "undefined")
        return "/";
    return window.location.pathname || "/";
}
function readConnectionType() {
    if (typeof navigator === "undefined")
        return undefined;
    const conn = navigator
        .connection;
    return conn?.effectiveType?.trim() || undefined;
}
export function buildWebVitalProperties(metric) {
    const name = metric.name;
    return {
        metric: name,
        value: metric.value,
        rating: metric.rating,
        path: readPagePath(),
        id: metric.id,
        navigation_type: metric.navigationType,
        connection_type: readConnectionType(),
    };
}
let webVitalsInstalled = false;
let webVitalsCaptureEnabled = false;
/** Toggle capture without unregistering library listeners (checked on every report). */
export function setWebVitalsCaptureEnabled(enabled) {
    webVitalsCaptureEnabled = enabled;
}
export function isWebVitalsCaptureEnabled() {
    return webVitalsCaptureEnabled;
}
/** Register Core Web Vitals listeners; calls `report` once per finalized metric sample. */
export function installWebVitals(report) {
    if (webVitalsInstalled)
        return;
    if (typeof window === "undefined" ||
        typeof document === "undefined" ||
        typeof window.addEventListener !== "function") {
        return;
    }
    webVitalsInstalled = true;
    void import("web-vitals")
        .then(({ onCLS, onINP, onLCP, onTTFB }) => {
        if (!webVitalsCaptureEnabled) {
            webVitalsInstalled = false;
            return;
        }
        const handle = (metric) => {
            if (!webVitalsCaptureEnabled)
                return;
            report(buildWebVitalProperties(metric));
        };
        onCLS(handle);
        onINP(handle);
        onLCP(handle);
        onTTFB(handle);
    })
        .catch((err) => {
        console.warn("[telemetry] web vitals install failed:", err);
        webVitalsInstalled = false;
    });
}
/** @internal Test helper — reset install guard. */
export function resetWebVitalsInstallState() {
    webVitalsInstalled = false;
    webVitalsCaptureEnabled = false;
}
