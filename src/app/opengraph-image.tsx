import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt = "SC Design Wirral — Architectural Design across Wirral, Cheshire & North Wales";
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
        background: "#211e1b",
        color: "#f5efe5",
      }}
    >
      <div style={{ fontSize: 30, letterSpacing: 6, color: "#c75b5b", textTransform: "uppercase" }}>
        SC Design Wirral
      </div>
      <div style={{ fontSize: 68, marginTop: 24, lineHeight: 1.1, maxWidth: 900 }}>
        Architectural design for extensions, lofts &amp; planning across Wirral
      </div>
      <div style={{ fontSize: 28, marginTop: 32, color: "rgba(245,239,229,0.7)" }}>
        15+ years · Wirral, Cheshire &amp; North Wales · design to planning-ready
      </div>
    </div>,
    { ...size }
  );
}
