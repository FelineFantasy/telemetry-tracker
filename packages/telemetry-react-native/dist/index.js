import { init as coreInit, identify, trackEvent, trackError as coreTrackError, screen as coreScreen, getSessionId, endSession, SDK_VERSION, } from "@telemetry-tracker/core";
const g = typeof globalThis !== "undefined" ? globalThis : undefined;
const ErrorUtils = g != null && typeof g.ErrorUtils !== "undefined"
    ? g.ErrorUtils
    : undefined;
export function init(config) {
    coreInit(config);
    if (ErrorUtils?.setGlobalHandler) {
        ErrorUtils.setGlobalHandler((error) => {
            coreTrackError(error, { source: "globalHandler" });
        });
    }
}
export { identify, trackEvent, coreTrackError as trackError, coreScreen as screen, getSessionId, endSession, SDK_VERSION, };
export function trackScreen(name) {
    coreScreen(name);
}
