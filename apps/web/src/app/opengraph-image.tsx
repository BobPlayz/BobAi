import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Bob AI workspace";
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
          justifyContent: "center",
          padding: 80,
          background: "#07090c",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, color: "#67e8f9", marginBottom: 24 }}>BOB AI</div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3 }}>One clean place for</div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, color: "#67e8f9" }}>your AI work.</div>
        <div style={{ fontSize: 28, marginTop: 32, color: "#a1a1aa" }}>Chat · research · creation · development</div>
      </div>
    ),
    size,
  );
}
