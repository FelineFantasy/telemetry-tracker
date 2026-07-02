import { ImageResponse } from "next/og";

export const alt = "Telemetry Tracker — Observability for teams that ship";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(145deg, #0a0a0a 0%, #12141a 45%, #0d1118 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#141418",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 16 16" fill="none">
              <path
                d="M1 9 L4 9 L6 3 L10 13 L12 7 L15 7"
                stroke="#fafafa"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Telemetry Tracker
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            Observability for teams that ship.
          </div>
          <div style={{ fontSize: 26, lineHeight: 1.4, color: "rgba(250,250,250,0.72)" }}>
            Errors, events, sessions, alerts & source maps — lightweight SDKs, fast dashboard.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 20, color: "rgba(250,250,250,0.55)" }}>
          <span>telemetry-tracker.com</span>
          <span>·</span>
          <span>Open source · Self-hosted or cloud</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
