import { ImageResponse } from "next/og";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const x = searchParams.get("x") ?? "25000";
    const y = searchParams.get("y") ?? "25000";
    const z = searchParams.get("z") ?? "1.0";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#17181a",
            backgroundImage:
              "radial-gradient(circle at 25px 25px, #2a2b2e 2px, transparent 0)",
            backgroundSize: "40px 40px",
            color: "#f5f1e6",
            fontFamily: "monospace",
            padding: "40px",
            boxSizing: "border-box",
            border: "8px solid #8c3b2b",
          }}
        >
          {/* Top Rivet Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              marginBottom: "30px",
              borderBottom: "2px solid #3a3b3e",
              paddingBottom: "16px",
            }}
          >
            <div style={{ fontSize: "20px", color: "#e0b13a", fontWeight: "bold" }}>
              ⚙️ ALWAYSDRAW.IO
            </div>
            <div
              style={{
                fontSize: "16px",
                color: "#f5f1e6",
                backgroundColor: "#2a2b2e",
                padding: "6px 14px",
                borderRadius: "4px",
                border: "1px solid #3a3b3e",
              }}
            >
              SHARED COLLABORATIVE WORLD
            </div>
          </div>

          {/* Main Content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: "64px",
                fontWeight: "900",
                color: "#f5f1e6",
                letterSpacing: "0.15em",
                margin: "0 0 10px 0",
                textTransform: "uppercase",
              }}
            >
              ALWAYS DRAW
            </h1>
            <p
              style={{
                fontSize: "24px",
                color: "#e0432b",
                margin: "0 0 30px 0",
                fontWeight: "bold",
              }}
            >
              One world. One canvas. Always drawing.
            </p>

            {/* Coordinate Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                backgroundColor: "#2a2b2e",
                border: "2px solid #e0b13a",
                padding: "16px 32px",
                borderRadius: "6px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              }}
            >
              <span style={{ fontSize: "22px", color: "#e0b13a", fontWeight: "bold" }}>
                📍 LOCATION:
              </span>
              <span style={{ fontSize: "22px", color: "#f5f1e6", fontWeight: "bold" }}>
                ({x}, {y}) @ {z}x ZOOM
              </span>
            </div>
          </div>

          {/* Bottom Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              marginTop: "30px",
              paddingTop: "16px",
              borderTop: "2px solid #3a3b3e",
              fontSize: "16px",
              color: "#8c8d90",
            }}
          >
            <span>The World&apos;s Shared Canvas</span>
            <span>Real-Time Live Sync</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (err) {
    console.error("OG Image generation failed:", err);
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
