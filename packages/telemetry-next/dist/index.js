"use client";
import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { init as coreInit, identify, trackError as coreTrackError, screen as coreScreen, } from "@tacko/telemetry-core";
let initialized = false;
export function init(config) {
    coreInit(config);
    initialized = true;
    if (typeof window !== "undefined") {
        window.__telemetry_initialized = true;
    }
}
export { identify };
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
    React.useEffect(() => {
        init(config);
    }, [config.ingestUrl, config.app]);
    return _jsx(_Fragment, { children: children });
}
export function useTrackPage(pathname) {
    React.useEffect(() => {
        if (typeof window === "undefined")
            return;
        coreScreen(pathname || "/");
    }, [pathname]);
}
