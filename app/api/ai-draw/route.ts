import { NextResponse } from "next/server";
import { generateAiStrokes as generateProceduralStrokes } from "@/lib/aiDrawer";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, center = { x: 0, y: 0 }, color = "#d94626", brushType = "neonGlow" } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback to procedural vector generation if no API key is configured
      const strokes = generateProceduralStrokes({ prompt, center, color, brushType });
      return NextResponse.json({ strokes, source: "procedural" });
    }

    const systemPrompt = `You are a real-time vector path artist for an online canvas. 
Your task is to draw the requested subject "${prompt}" centered around coordinate (${center.x}, ${center.y}).
Generate 4 to 8 smooth vector stroke paths. Each stroke must contain 5 to 20 coordinate points ({x, y}) detailing the contours and shapes.
Keep points within 150 units of center coordinate (${center.x}, ${center.y}).
Use vibrant hex colors (e.g. #d94626, #39c07a, #2f9fe0, #ffcc00, #c14fd6).
Valid brushType values: "neonGlow", "brush", "watercolor", "calligraphy", "oilPaint", "pencil".`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    if (!res.ok) {
      console.warn("Gemini API call failed, using procedural fallback");
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

    return NextResponse.json({ strokes, source: "gemini-2.0-flash" });
  } catch (error) {
    console.error("AI Draw API error:", error);
    const body = await request.json().catch(() => ({}));
    const strokes = generateProceduralStrokes({
      prompt: body.prompt || "artwork",
      center: body.center || { x: 0, y: 0 },
      color: body.color || "#d94626",
      brushType: body.brushType || "neonGlow",
    });
    return NextResponse.json({ strokes, source: "procedural-error-fallback" });
  }
}
