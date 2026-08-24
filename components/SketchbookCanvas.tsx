// components/SketchbookCanvas.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH } from "@/convex/constants";
import type { StrokeMode, Point } from "@/lib/types";
import { getClientId, getUsername, getCachedCountryCode } from "@/lib/identity";
import { drawStroke, drawSegment } from "@/lib/drawing";
import { screenToWorld, worldToScreen } from "@/lib/coordinates";
import type { Camera } from "@/lib/camera";
import { StrokeBuffer } from "@/lib/strokeBuffer";
import { PALETTE_PRESETS } from "@/lib/palettes";
import {
  SKETCHBOOK_PAGES,
  findRegionAt,
  regionPathData,
  type SketchbookRegion,
} from "@/lib/sketchbookPages";

const DEFAULT_WIDTH = 16;
const DEFAULT_COLOR = PALETTE_PRESETS[0].colors[2];

// ponytail: server rejects a whole chunk if any point falls outside the page
// rect, so clamp here (not lib/coordinates' clampToWorld — that's the main
// canvas's 20000x20000 world, wrong bounds for this fixed-size page).
function clampToPage(pt: Point, width: number, height: number): Point {
  return {
    x: Math.min(width, Math.max(0, pt.x)),
    y: Math.min(height, Math.max(0, pt.y)),
  };
}

type SketchbookStroke = {
  clientStrokeId: string;
  sequence: number;
  mode: StrokeMode;
  regionId: string;
  color: string;
  width: number;
  opacity?: number;
  points: Point[];
};

export function SketchbookCanvas({ pageId }: { pageId: string }) {
  // Non-null: the route (app/sketchbook/[pageId]/page.tsx) already calls
  // getSketchbookPage(pageId) and notFound()s before this ever mounts.
  const page = SKETCHBOOK_PAGES[pageId]!;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cameraRef = useRef<Camera>({ x: page.width / 2, y: page.height / 2, zoom: 1 });
  const viewportRef = useRef({ width: 0, height: 0 });
  const regionPathsRef = useRef<Map<string, Path2D>>(new Map());

  const [tool, setTool] = useState<StrokeMode>("draw");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [afterSequence, setAfterSequence] = useState(0);

  const clientIdRef = useRef(getClientId());
  const usernameRef = useRef(getUsername());
  const countryCodeRef = useRef(getCachedCountryCode());

  // ponytail: replay (after a resize) draws strokes in arrival order, not
  // true server sequence — own in-flight strokes are appended before their
  // server sequence is known. Fine for a coloring page (draw/erase order
  // rarely matters visually); revisit with sequence-sorted replay if
  // resize artifacts become noticeable in practice.
  const allStrokesRef = useRef<SketchbookStroke[]>([]);
  const renderedIdsRef = useRef<Set<string>>(new Set());
  const activeRegionRef = useRef<SketchbookRegion | null>(null);
  const bufferRef = useRef<StrokeBuffer | null>(null);
  const lastWorldPointRef = useRef<Point | null>(null);

  const submitStroke = useMutation(api.sketchbookStrokes.submit);
  const liveTail = useQuery(api.sketchbookStrokes.listSince, { pageId, afterSequence });

  const drawStrokeClipped = useCallback((stroke: SketchbookStroke) => {
    const ctx = ctxRef.current;
    const path2d = regionPathsRef.current.get(stroke.regionId);
    if (!ctx || !path2d) return;
    const { width: vw, height: vh } = viewportRef.current;
    ctx.save();
    ctx.clip(path2d);
    drawStroke(ctx, cameraRef.current, vw, vh, stroke.points, stroke.mode, stroke.color, stroke.width);
    ctx.restore();
  }, []);

  const replayAll = useCallback(() => {
    for (const stroke of allStrokesRef.current) {
      drawStrokeClipped(stroke);
    }
  }, [drawStrokeClipped]);

  // Resize: track viewport size, scale the canvas backing store to
  // devicePixelRatio, fit the fixed page to the viewport, rebuild each
  // region's clip Path2D in that screen space, and replay history — both
  // resizing the canvas element and a camera change invalidate what was
  // there before (a canvas resize clears its bitmap; a stale Path2D would
  // clip against the old scale).
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      viewportRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;

      const zoom = Math.min(rect.width / page.width, rect.height / page.height);
      cameraRef.current = { x: page.width / 2, y: page.height / 2, zoom };

      const paths = new Map<string, Path2D>();
      for (const region of page.regions) {
        const screenPts = region.points.map((p) => worldToScreen(p.x, p.y, cameraRef.current, rect.width, rect.height));
        paths.set(region.id, new Path2D(regionPathData({ id: region.id, points: screenPts })));
      }
      regionPathsRef.current = paths;

      replayAll();
    };

    resize();
    // ponytail: rAF-debounce so a window-edge drag (many ResizeObserver
    // callbacks per second) only replays the full stroke history once per
    // frame instead of once per callback.
    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        resize();
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [replayAll, page]);

  useEffect(() => {
    if (!errorMessage) return;
    const id = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(id);
  }, [errorMessage]);

  // Apply newly synced strokes as they arrive.
  useEffect(() => {
    if (!liveTail || liveTail.length === 0) return;
    let maxSeq = afterSequence;
    for (const row of liveTail) {
      maxSeq = Math.max(maxSeq, row.sequence);
      if (renderedIdsRef.current.has(row.clientStrokeId)) continue;
      renderedIdsRef.current.add(row.clientStrokeId);
      allStrokesRef.current.push(row);
      drawStrokeClipped(row);
    }
    setAfterSequence(maxSeq);
  }, [liveTail, afterSequence, drawStrokeClipped]);

  const commitChunk = useCallback(
    (
      points: Point[],
      mode: StrokeMode,
      regionId: string,
      chunkColor: string,
      chunkWidth: number,
      clientStrokeId: string,
    ) => {
      const stroke: SketchbookStroke = {
        clientStrokeId,
        sequence: -1,
        mode,
        regionId,
        color: chunkColor,
        width: chunkWidth,
        opacity: 1,
        points,
      };
      renderedIdsRef.current.add(clientStrokeId);
      allStrokesRef.current.push(stroke);
      submitStroke({
        clientStrokeId,
        clientId: clientIdRef.current,
        username: usernameRef.current,
        countryCode: countryCodeRef.current,
        mode,
        pageId,
        regionId,
        color: chunkColor,
        width: chunkWidth,
        opacity: 1,
        points,
        clientTimestamp: Date.now(),
      }).catch((err) => {
        console.error("sketchbook stroke submit rejected", err);
        renderedIdsRef.current.delete(clientStrokeId);
        allStrokesRef.current = allStrokesRef.current.filter((s) => s.clientStrokeId !== clientStrokeId);
        const ctx = ctxRef.current;
        if (ctx) {
          const { width: vw, height: vh } = viewportRef.current;
          ctx.clearRect(0, 0, vw, vh);
          replayAll();
        }
        setErrorMessage(err instanceof ConvexError ? "drawing too fast — pace yourself a sec" : "a mark didn't stick — try again");
      });
    },
    [submitStroke, replayAll, pageId],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const rawWorldPt = screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height);
      const region = findRegionAt(page.regions, rawWorldPt.x, rawWorldPt.y);
      if (!region) return;

      const worldPt = clampToPage(rawWorldPt, page.width, page.height);

      canvas.setPointerCapture(e.pointerId);
      activeRegionRef.current = region;
      lastWorldPointRef.current = worldPt;

      const regionId = region.id;
      const mode = tool;
      const chunkColor = color;
      const chunkWidth = width;
      bufferRef.current = new StrokeBuffer(
        clientIdRef.current,
        mode,
        undefined,
        chunkColor,
        chunkWidth,
        1,
        usernameRef.current,
        countryCodeRef.current,
        (chunk) => commitChunk(chunk.points, mode, regionId, chunkColor, chunkWidth, chunk.clientStrokeId),
      );
      bufferRef.current.addPoint(worldPt);

      const ctx = ctxRef.current;
      const path2d = regionPathsRef.current.get(regionId);
      if (ctx && path2d) {
        ctx.save();
        ctx.clip(path2d);
        drawStroke(ctx, cameraRef.current, viewportRef.current.width, viewportRef.current.height, [worldPt], mode, chunkColor, chunkWidth);
        ctx.restore();
      }
    },
    [tool, color, width, commitChunk, page],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const buffer = bufferRef.current;
      const region = activeRegionRef.current;
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!buffer || !region || !canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPt = clampToPage(
        screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height),
        page.width,
        page.height,
      );

      const from = lastWorldPointRef.current ?? worldPt;
      const path2d = regionPathsRef.current.get(region.id);
      if (path2d) {
        ctx.save();
        ctx.clip(path2d);
        drawSegment(ctx, cameraRef.current, viewportRef.current.width, viewportRef.current.height, from, worldPt, buffer.mode, buffer.color, buffer.width);
        ctx.restore();
      }
      lastWorldPointRef.current = worldPt;
      buffer.addPoint(worldPt);
    },
    [page],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    bufferRef.current?.finish();
    bufferRef.current = null;
    activeRegionRef.current = null;
    lastWorldPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }, []);

  const outlinePaths = useMemo(
    () => page.regions.map((region) => ({ id: region.id, d: regionPathData(region) })),
    [page],
  );

  return (
    <div ref={containerRef} className="relative h-dvh w-full overflow-hidden bg-[#f0ebd9]">
      <Link
        href="/sketchbook"
        className="absolute top-4 left-4 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-[#1a1a1a] shadow-lg"
      >
        ← Sketchbook
      </Link>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${page.width} ${page.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {outlinePaths.map((p) => (
          <path key={p.id} d={p.d} fill="none" stroke="#1a1a1a" strokeWidth={3} strokeLinejoin="round" />
        ))}
      </svg>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow-lg">
        {PALETTE_PRESETS[0].colors.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`color ${swatch}`}
            onClick={() => {
              setColor(swatch);
              setTool("draw");
            }}
            className="h-7 w-7 rounded-full border-2"
            style={{ backgroundColor: swatch, borderColor: color === swatch && tool === "draw" ? "#1a1a1a" : "transparent" }}
          />
        ))}
        <input
          type="range"
          aria-label="brush width"
          min={MIN_BRUSH_WIDTH}
          max={MAX_BRUSH_WIDTH}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-24"
        />
        <button
          type="button"
          aria-pressed={tool === "erase"}
          onClick={() => setTool((t) => (t === "erase" ? "draw" : "erase"))}
          className={`rounded-full px-3 py-1 text-sm font-medium ${tool === "erase" ? "bg-[#1a1a1a] text-white" : "bg-black/10"}`}
        >
          Eraser
        </button>
      </div>
      {errorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-sm text-white">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
