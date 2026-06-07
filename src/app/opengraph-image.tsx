import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt = "SC Design & Construction — Architectural Design across Wirral";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#1c1d1f",
        color: "#f7f5f1",
      }}
    >
      <div style={{ fontSize: 30, letterSpacing: 6, color: "#b9743f", textTransform: "uppercase" }}>
        SC Design &amp; Construction
      </div>
      <div style={{ fontSize: 68, marginTop: 24, lineHeight: 1.1, maxWidth: 900 }}>
        Architectural design for extensions, lofts &amp; planning across Wirral
      </div>
      <div style={{ fontSize: 28, marginTop: 32, color: "rgba(247,245,241,0.7)" }}>
        18+ years · Wallasey-based · design to planning-ready drawings
      </div>
    </div>,
    { ...size }
  );
}
