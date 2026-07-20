"use client";
import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { init as coreInit, shutdown as coreShutdown, identify, trackEvent as coreTrackEvent, trackError as coreTrackError, screen as coreScreen, getSessionId, endSession, } from "@telemetry-tracker/core";
let initialized = false;
export function init(config) {
    coreInit(config);
    initialized = true;
    if (typeof window !== "undefined") {
        window.__telemetry_initialized = true;
    }
}
export function shutdown() {
    coreShutdown();
    initialized = false;
    if (typeof window !== "undefined") {
        window.__telemetry_initialized = false;
    }
}
export { identify, coreTrackEvent as trackEvent, coreScreen as screen, getSessionId, endSession, };
export function trackError(error, context) {
    coreTrackError(error, context);
}
export function useTelemetryRouter(pathname) {
    if (typeof window === "undefined" || !initialized)
        return;
    coreScreen(pathname || "/");
}
export class TelemetryErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error) {
        try {
            coreTrackError(error, { boundary: "TelemetryErrorBoundary" });
        }
        catch (_) { }
    }
    render() {
        if (this.state.hasError && this.props.fallback)
            return this.props.fallback;
        if (this.state.hasError)
            return null;
        return this.props.children;
    }
}
export function TelemetryProvider({ config, children, }) {
    // Layout effect so init/session exist before child useEffects (e.g. useTrackPage).
    React.useLayoutEffect(() => {
        init(config);
        return () => {
            shutdown();
        };
    }, [config.ingestUrl, config.app]);
    return _jsx(_Fragment, { children: children });
}
export function useTrackPage(pathname) {
    React.useEffect(() => {
        if (typeof window === "undefined" || !initialized)
            return;
        coreScreen(pathname || "/");
    }, [pathname]);
}
