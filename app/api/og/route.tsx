import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get("title") || "The World's Shared Real-Time Canvas";
    const x = searchParams.get("x") || "0";
    const y = searchParams.get("y") || "0";
    const mode = searchParams.get("mode") || "Live Canvas";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "between",
            backgroundColor: "#121315",
            backgroundImage: "radial-gradient(ellipse at top, rgba(217,70,38,0.25), transparent 70%)",
            padding: "48px 64px",
            fontFamily: "sans-serif",
            color: "#f5f1e6",
            border: "8px solid #d94626",
            boxSizing: "border-box",
          }}
        >
          {/* TOP BAR */}
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  height: "48px",
                  width: "48px",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  backgroundColor: "#d94626",
                  color: "#ffffff",
                  fontSize: "24px",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                }}
              >
                AD
              </div>
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  letterSpacing: "-1px",
                }}
              >
                AlwaysDraw<span style={{ color: "#d94626" }}>.com</span>
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "20px",
                border: "2px solid #34383e",
                backgroundColor: "#1b1d21",
                fontSize: "18px",
                fontWeight: "bold",
                color: "#ffcc00",
                fontFamily: "monospace",
              }}
            >
              <div
                style={{
                  height: "12px",
                  width: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                }}
              />
              <span>{mode.toUpperCase()}</span>
            </div>
          </div>

          {/* CENTER CONTENT */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              marginTop: "20px",
              marginBottom: "20px",
            }}
          >
            <h1
              style={{
                fontSize: "56px",
                fontWeight: "900",
                lineHeight: "1.1",
                margin: "0 0 16px 0",
                color: "#ffffff",
                letterSpacing: "-1px",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: "24px",
                color: "#a0a5ad",
                margin: 0,
                maxWidth: "850px",
                lineHeight: "1.4",
              }}
            >
              One world. One canvas. Always drawing. Sketch, doodle, and paint in real time with 13 artistic brush textures.
            </p>
          </div>

          {/* BOTTOM FOOTER BAR */}
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "2px solid #26292e",
              paddingTop: "24px",
              fontSize: "18px",
              fontFamily: "monospace",
              color: "#a0a5ad",
            }}
          >
            <div>📍 Viewport Coordinates: X={x}, Y={y}</div>
            <div style={{ color: "#d94626", fontWeight: "bold" }}>alwaysdraw.com/canvas</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
