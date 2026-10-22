import { ImageResponse } from "next/og";

export const alt = "Jarvis — an assistant, not an oracle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share card in the paper-and-ink style, rendered at build time (no image file to maintain). */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#f2ede3", color: "#15130f", fontFamily: "serif" }}>
        <div style={{ display: "flex", fontSize: 44 }}>
          Jarvis<span style={{ color: "#d9381e" }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 108, lineHeight: 0.95, letterSpacing: -3 }}>
          <span>An assistant,</span>
          <span style={{ color: "#d9381e", fontStyle: "italic" }}>not an oracle.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#6b6357", borderTop: "2px solid #15130f", paddingTop: 24, fontFamily: "monospace" }}>
          <span>LOCAL-FIRST AI ASSISTANT</span>
          <span>RUNS ON OLLAMA</span>
        </div>
      </div>
    ),
    size,
  );
}
