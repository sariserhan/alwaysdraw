import type { ServerStroke, LocalStroke } from "./types";
import type { Camera } from "./camera";
import { clearCanvas, drawWorldBackground, drawStroke } from "./drawing";
import { renderBrushStroke } from "./brushes";

export function downloadCanvasPNG(
  canvas: HTMLCanvasElement,
  filename = "alwaysdraw-snapshot.png",
) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export interface TimelapseOptions {
  strokes: (ServerStroke | LocalStroke)[];
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  onProgress?: (progress: number) => void;
}

/**
 * Renders an offscreen canvas replay sequence of strokes and encodes them into a downloadable WebM video blob.
 */
export async function generateTimelapseVideo({
  strokes,
  camera,
  viewportWidth,
  viewportHeight,
  worldWidth,
  worldHeight,
  onProgress,
}: TimelapseOptions): Promise<Blob> {
  const offscreen = document.createElement("canvas");
  offscreen.width = viewportWidth;
  offscreen.height = viewportHeight;
  const ctx = offscreen.getContext("2d");
  if (!ctx) throw new Error("Could not create offscreen canvas context");

  const stream = offscreen.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: "video/webm" }));
    };
  });

  recorder.start();

  // Clear & render background
  clearCanvas(ctx, viewportWidth, viewportHeight);
  drawWorldBackground(ctx, camera, viewportWidth, viewportHeight, worldWidth, worldHeight);

  const total = strokes.length;
  const stepSize = Math.max(1, Math.floor(total / 50));

  for (let i = 0; i < total; i++) {
    const s = strokes[i];
    if (s.mode === "erase") {
      drawStroke(ctx, camera, viewportWidth, viewportHeight, s.points, "erase", s.color, s.width);
    } else {
      renderBrushStroke(s.brushType, {
        ctx,
        camera,
        viewportWidth,
        viewportHeight,
        points: s.points,
        color: s.color,
        width: s.width,
        opacity: s.opacity ?? 1,
      });
    }

    if (i % stepSize === 0 || i === total - 1) {
      if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
      // Give MediaRecorder a frame tick
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  // Hold last frame for 1 second
  await new Promise((r) => setTimeout(r, 1000));

  recorder.stop();
  return recordingPromise;
}
