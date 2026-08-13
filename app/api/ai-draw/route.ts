import { NextResponse } from "next/server";
import { generateAiStrokes as generateProceduralStrokes } from "@/lib/aiDrawer";
import type { BrushType, Point } from "@/lib/types";

export const runtime = "edge";

const GEMINI_TIMEOUT_MS = 10_000;

// Per-isolate sliding window — no caller identity is passed in the request
// body, so this limits by IP. Edge isolates aren't shared across regions, so
// this is a soft cap, not a hard distributed limit.
// ponytail: in-memory limiter, good enough for an admin-only feature; move
// to the Convex-backed limiter (convex/abuse.ts) if this needs real
// cross-region enforcement.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return false;
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  return NextResponse.json({
    hasApiKey: Boolean(apiKey),
    engine: apiKey ? "gemini-flash-latest" : "procedural",
    statusMessage: apiKey
      ? "🟢 Gemini Flash Model Active (Real AI)"
      : "🟡 Procedural Path Engine Active (Set GEMINI_API_KEY in .env.local to activate Gemini)",
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const { prompt, center = { x: 0, y: 0 }, color = "#d94626", brushType = "neonGlow" } = body as {
    prompt: string;
    center?: Point;
    color?: string;
    brushType?: BrushType;
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback to procedural vector generation if no API key is configured
      const strokes = generateProceduralStrokes({ prompt, center, color, brushType });
      return NextResponse.json({ strokes, source: "procedural" });
    }

    const clientKey = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(clientKey)) {
      const strokes = generateProceduralStrokes({ prompt, center, color, brushType });
      return NextResponse.json({ strokes, source: "rate-limited" });
    }

    const systemPrompt = `You are a real-time vector path artist for an online canvas.
Your task is to draw the requested subject "${prompt}" centered around coordinate (${center.x}, ${center.y}).
Generate 4 to 8 smooth vector stroke paths. Each stroke must contain 5 to 20 coordinate points ({x, y}) detailing the contours and shapes.
Keep points within 150 units of center coordinate (${center.x}, ${center.y}).
Use vibrant hex colors (e.g. #d94626, #39c07a, #2f9fe0, #ffcc00, #c14fd6).
Valid brushType values: "neonGlow", "brush", "watercolor", "calligraphy", "oilPaint", "pencil".`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `Draw: ${prompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                strokes: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      points: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            x: { type: "NUMBER" },
                            y: { type: "NUMBER" },
                          },
                          required: ["x", "y"],
                        },
                      },
                      color: { type: "STRING" },
                      width: { type: "NUMBER" },
                      brushType: { type: "STRING" },
                    },
                    required: ["points", "color"],
                  },
                },
              },
              required: ["strokes"],
            },
          },
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn("Gemini API call failed, using procedural fallback", res.status, errBody.slice(0, 500));
      const strokes = generateProceduralStrokes({ prompt, center, color, brushType });
      return NextResponse.json({ strokes, source: "procedural-fallback" });
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      const strokes = generateProceduralStrokes({ prompt, center, color, brushType });
      return NextResponse.json({ strokes, source: "procedural-fallback" });
    }

    const parsed = JSON.parse(candidateText);
    const strokes = (parsed.strokes || []).map((s: any) => ({
      points: s.points || [],
      color: s.color || color,
      brushType: s.brushType || brushType,
      width: s.width || 4,
      opacity: 1,
    }));

    if (!strokes.length) {
      const fallbackStrokes = generateProceduralStrokes({ prompt, center, color, brushType });
      return NextResponse.json({ strokes: fallbackStrokes, source: "procedural-fallback" });
    }

    return NextResponse.json({ strokes, source: "gemini-flash-latest" });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.error("AI Draw API error:", isTimeout ? "Gemini request timed out" : error);
    const strokes = generateProceduralStrokes({
      prompt: prompt || "artwork",
      center: center || { x: 0, y: 0 },
      color: color || "#d94626",
      brushType: brushType || "neonGlow",
    });
    return NextResponse.json({ strokes, source: isTimeout ? "procedural-timeout-fallback" : "procedural-error-fallback" });
  }
}
