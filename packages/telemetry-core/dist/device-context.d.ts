/** Lightweight browser/OS hints for session ingest (no UA parser dependency). */
export type DeviceContext = {
    device_browser?: string;
    device_os?: string;
    country?: string;
};
/** Best-effort device + country from the runtime environment. */
export declare function readDeviceContext(): DeviceContext;
//# sourceMappingURL=device-context.d.ts.map