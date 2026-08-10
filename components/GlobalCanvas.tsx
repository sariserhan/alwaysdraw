"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";
import {
  type Camera,
  defaultCamera,
  panBy,
  zoomAt,
  clampZoom,
  distance,
} from "@/lib/camera";
import { screenToWorld, clampToWorld } from "@/lib/coordinates";
import { clearCanvas, drawWorldBackground, drawStroke } from "@/lib/drawing";
import { renderBrushStroke } from "@/lib/brushes";
import { StrokeBuffer } from "@/lib/strokeBuffer";
import { getClientId } from "@/lib/identity";
import type { LocalStroke, ServerStroke, Point, Tool, BrushType } from "@/lib/types";
import { DrawingToolbar } from "./DrawingToolbar";
import { OnlineCount } from "./OnlineCount";
import { ConnectionStatus } from "./ConnectionStatus";
import { RemoteCursors } from "./RemoteCursors";
import { ThemeToggle } from "./ThemeToggle";
import { ChromeRivet } from "./ChromeRivet";
import { BrushCursor } from "./BrushCursor";

const MIN_CURSOR_DIAMETER_PX = 4;

const LIVE_TAIL_LIMIT = 300;
const REPLAY_PAGE_SIZE = 1000;
// Dev-only safety cap on full-history replay; V2 replaces this with snapshots.
const REPLAY_HARD_CAP = 20000;

export function GlobalCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Two stacked canvases: `worldCanvasRef` paints the static wall (never
  // erasable) underneath; `canvasRef` carries every stroke and receives
  // pointer input. Erasing (destination-out) clears pixels on the strokes
  // layer only, revealing the wall layer beneath it — not a transparent
  // hole through to the page background.
  const worldCanvasRef = useRef<HTMLCanvasElement>(null);
  const worldCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cursorElRef = useRef<HTMLDivElement>(null);
  const lastScreenPosRef = useRef<Point | null>(null);

  const [clientId] = useState(() => getClientId());
  const cameraRef = useRef<Camera>(defaultCamera(WORLD_WIDTH, WORLD_HEIGHT));
  const viewportRef = useRef({ width: 0, height: 0 });

  const committedRef = useRef<ServerStroke[]>([]);
  const appliedIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, LocalStroke>>(new Map());
  const [replayDone, setReplayDone] = useState(false);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushType, setBrushType] = useState<BrushType>("brush");
  const [color, setColor] = useState("#17181a");
  const [brushWidth, setBrushWidth] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Snapshots of ref-held values, synced (in effects/callbacks, never during
  // render) only when something that must re-render RemoteCursors happens.
  const [cameraSnapshot, setCameraSnapshot] = useState<Camera>(() =>
    defaultCamera(WORLD_WIDTH, WORLD_HEIGHT),
  );
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const convex = useConvex();
  const submitStroke = useMutation(api.strokes.submit);
  const heartbeat = useMutation(api.presence.heartbeat);

  const onlineCount = useQuery(api.presence.onlineCount);
  const presenceList = useQuery(api.presence.list);
  const liveTail = useQuery(api.strokes.listRecent, { limit: LIVE_TAIL_LIMIT });

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  const redrawWorld = useCallback(() => {
    const ctx = worldCtxRef.current;
    if (!ctx) return;
    const { width, height } = viewportRef.current;
    clearCanvas(ctx, width, height);
    drawWorldBackground(ctx, cameraRef.current, width, height, WORLD_WIDTH, WORLD_HEIGHT);
  }, []);

  const paintOneStroke = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, s: LocalStroke) => {
    if (s.mode === "erase") {
      drawStroke(ctx, cameraRef.current, width, height, s.points, "erase", s.color, s.width);
      return;
    }
    renderBrushStroke(s.brushType, {
      ctx,
      camera: cameraRef.current,
      viewportWidth: width,
      viewportHeight: height,
      points: s.points,
      color: s.color,
      width: s.width,
      opacity: s.opacity ?? 1,
    });
  }, []);

  const redrawStrokes = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { width, height } = viewportRef.current;
    clearCanvas(ctx, width, height);
    for (const s of committedRef.current) paintOneStroke(ctx, width, height, s);
    for (const s of pendingRef.current.values()) paintOneStroke(ctx, width, height, s);
  }, [paintOneStroke]);

  // ---------------------------------------------------------------------
  // Brush cursor overlay: shows the brush's actual on-screen size/color so a
  // visitor always knows exactly how much of the wall their next stroke will
  // affect. Position/size are set imperatively (mousemove is too
  // high-frequency for React state); shape/color come from props, which
  // change rarely.
  // ---------------------------------------------------------------------
  const updateCursorOverlay = useCallback(() => {
    const el = cursorElRef.current;
    const pos = lastScreenPosRef.current;
    if (!el) return;
    if (!pos || (tool !== "brush" && tool !== "eraser")) {
      el.style.display = "none";
      return;
    }
    const diameter = Math.max(MIN_CURSOR_DIAMETER_PX, brushWidth * cameraRef.current.zoom);
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.style.width = `${diameter}px`;
    el.style.height = `${diameter}px`;
    el.style.display = "block";
  }, [tool, brushWidth]);

  useEffect(() => {
    updateCursorOverlay();
  }, [updateCursorOverlay]);

  const rafRef = useRef<number | null>(null);
  const dirtyRef = useRef({ world: true, strokes: true });
  const scheduleRedraw = useCallback(
    (dirty: { world?: boolean; strokes?: boolean } = { strokes: true }) => {
      if (dirty.world) dirtyRef.current.world = true;
      if (dirty.strokes) dirtyRef.current.strokes = true;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (dirtyRef.current.world) {
          redrawWorld();
          dirtyRef.current.world = false;
        }
        if (dirtyRef.current.strokes) {
          redrawStrokes();
          dirtyRef.current.strokes = false;
        }
        setCameraSnapshot({ ...cameraRef.current });
        setZoomPercent((prev) => {
          const next = Math.round(cameraRef.current.zoom * 100);
          return prev === next ? prev : next;
        });
        updateCursorOverlay();
      });
    },
    [redrawWorld, redrawStrokes, updateCursorOverlay],
  );

  const hideCursorOverlay = useCallback(() => {
    lastScreenPosRef.current = null;
    if (cursorElRef.current) cursorElRef.current.style.display = "none";
  }, []);

  // ---------------------------------------------------------------------
  // Canvas sizing / HiDPI
  // ---------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const worldCanvas = worldCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !worldCanvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      viewportRef.current = { width: rect.width, height: rect.height };
      setViewportSize({ width: rect.width, height: rect.height });
      for (const c of [canvas, worldCanvas]) {
        c.width = Math.round(rect.width * dpr);
        c.height = Math.round(rect.height * dpr);
        c.style.width = `${rect.width}px`;
        c.style.height = `${rect.height}px`;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctxRef.current = ctx;
      }
      const worldCtx = worldCanvas.getContext("2d");
      if (worldCtx) {
        worldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        worldCtxRef.current = worldCtx;
      }
      redrawWorld();
      redrawStrokes();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawWorld, redrawStrokes]);

  // Non-passive wheel listener so we can preventDefault (stop page/browser zoom).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { width, height } = viewportRef.current;
      const factor = Math.pow(1.0015, -e.deltaY);
      cameraRef.current = zoomAt(cameraRef.current, factor, screenX, screenY, width, height);
      scheduleRedraw({ world: true, strokes: true });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [scheduleRedraw]);

  // ---------------------------------------------------------------------
  // Initial replay (historical strokes -> committed list -> first paint)
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function replay() {
      let after = 0;
      let total = 0;
      while (!cancelled) {
        const page = await convex.query(api.strokes.listSince, {
          afterSequence: after,
          limit: REPLAY_PAGE_SIZE,
        });
        if (page.length === 0) break;
        for (const s of page) {
          committedRef.current.push(s);
          appliedIdsRef.current.add(s.clientStrokeId);
          after = Math.max(after, s.sequence);
        }
        total += page.length;
        if (page.length < REPLAY_PAGE_SIZE || total >= REPLAY_HARD_CAP) break;
      }
      if (!cancelled) {
        setReplayDone(true);
        scheduleRedraw();
      }
    }
    replay();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------
  // Live tail: apply strokes we haven't seen yet (remote, or our own confirmed)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!replayDone || !liveTail) return;
    let changed = false;
    for (const s of liveTail) {
      if (appliedIdsRef.current.has(s.clientStrokeId)) continue;
      appliedIdsRef.current.add(s.clientStrokeId);
      pendingRef.current.delete(s.clientStrokeId);
      committedRef.current.push(s);
      changed = true;
    }
    if (changed) scheduleRedraw();
  }, [liveTail, replayDone, scheduleRedraw]);

  // ---------------------------------------------------------------------
  // Presence heartbeat
  // ---------------------------------------------------------------------
  const lastCursorWorldRef = useRef<Point>({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });
  useEffect(() => {
    const send = () => {
      heartbeat({
        clientId,
        cursorX: lastCursorWorldRef.current.x,
        cursorY: lastCursorWorldRef.current.y,
      }).catch(() => {});
    };
    send();
    const id = setInterval(send, 5000);
    return () => clearInterval(id);
  }, [heartbeat, clientId]);

  // ---------------------------------------------------------------------
  // Local-first drawing
  // ---------------------------------------------------------------------
  const commitOwnChunk = useCallback(
    (chunk: LocalStroke) => {
      pendingRef.current.set(chunk.clientStrokeId, chunk);
      submitStroke(chunk).catch((err) => {
        console.error("stroke submit rejected", err);
        pendingRef.current.delete(chunk.clientStrokeId);
        setSubmitError("a mark didn't stick — try again");
      });
    },
    [submitStroke],
  );

  useEffect(() => {
    if (!submitError) return;
    const id = setTimeout(() => setSubmitError(null), 4000);
    return () => clearTimeout(id);
  }, [submitError]);

  const drawBufferRef = useRef<StrokeBuffer | null>(null);
  const lastDrawWorldRef = useRef<Point | null>(null);

  const beginDraw = useCallback(
    (worldPoint: Point) => {
      const buffer = new StrokeBuffer(
        clientId,
        tool === "eraser" ? "erase" : "draw",
        tool === "eraser" ? undefined : brushType,
        color,
        brushWidth,
        opacity,
        commitOwnChunk,
      );
      buffer.addPoint(worldPoint);
      drawBufferRef.current = buffer;
      lastDrawWorldRef.current = worldPoint;
    },
    [commitOwnChunk, clientId, tool, brushType, color, brushWidth, opacity],
  );

  // Segment color/width/brush/mode come from the active buffer (locked in at
  // pointer-down), not live state, so an in-progress stroke stays consistent
  // even if the user changes tool settings mid-drag.
  const continueDraw = useCallback((worldPoint: Point) => {
    const buffer = drawBufferRef.current;
    if (!buffer) return;
    const ctx = ctxRef.current;
    const prev = lastDrawWorldRef.current;
    if (ctx && prev) {
      const { width, height } = viewportRef.current;
      if (buffer.mode === "erase") {
        drawStroke(ctx, cameraRef.current, width, height, [prev, worldPoint], "erase", buffer.color, buffer.width);
      } else {
        renderBrushStroke(buffer.brushType, {
          ctx,
          camera: cameraRef.current,
          viewportWidth: width,
          viewportHeight: height,
          points: [prev, worldPoint],
          color: buffer.color,
          width: buffer.width,
          opacity: buffer.opacity,
        });
      }
    }
    buffer.addPoint(worldPoint);
    lastDrawWorldRef.current = worldPoint;
  }, []);

  const endDraw = useCallback(() => {
    drawBufferRef.current?.finish();
    drawBufferRef.current = null;
    lastDrawWorldRef.current = null;
  }, []);

  // ---------------------------------------------------------------------
  // Pointer input: mouse (draw / space-pan / wheel-zoom) + touch (draw / 2-finger pan-pinch)
  // ---------------------------------------------------------------------
  const activePointersRef = useRef<Map<number, Point>>(new Map());
  const isPanningRef = useRef(false);
  const isSpaceDownRef = useRef(false);
  const lastPanScreenRef = useRef<Point | null>(null);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  // Explicit Zoom tool: drag up/down from the press point zooms in/out,
  // anchored at that point — a touch-friendly alternative to pinch/wheel.
  const zoomDragRef = useRef<{ startScreen: Point; startZoom: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceDownRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceDownRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const getScreenPoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const getPointerWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const screen = getScreenPoint(clientX, clientY);
      const { width, height } = viewportRef.current;
      return clampToWorld(screenToWorld(screen.x, screen.y, cameraRef.current, width, height));
    },
    [getScreenPoint],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Best-effort: keeps receiving events if the pointer leaves the canvas
      // bounds mid-drag. Can throw (e.g. no active OS pointer for this id) —
      // must not abort the rest of the handler if it does.
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      const screenPt = getScreenPoint(e.clientX, e.clientY);
      activePointersRef.current.set(e.pointerId, screenPt);

      if (e.pointerType === "touch" && activePointersRef.current.size === 2) {
        endDraw();
        zoomDragRef.current = null;
        isPanningRef.current = true;
        const pts = [...activePointersRef.current.values()];
        lastPanScreenRef.current = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        pinchStartRef.current = { dist: distance(pts[0], pts[1]), zoom: cameraRef.current.zoom };
        return;
      }

      if (activePointersRef.current.size > 1) return; // ignore a 3rd+ touch

      if (e.pointerType === "mouse" && (isSpaceDownRef.current || e.button === 1)) {
        isPanningRef.current = true;
        lastPanScreenRef.current = screenPt;
        return;
      }

      if (e.pointerType === "mouse" && e.button !== 0) return;

      if (tool === "pan") {
        isPanningRef.current = true;
        lastPanScreenRef.current = screenPt;
        return;
      }

      if (tool === "zoom") {
        zoomDragRef.current = { startScreen: screenPt, startZoom: cameraRef.current.zoom };
        return;
      }

      const worldPt = getPointerWorld(e.clientX, e.clientY);
      lastCursorWorldRef.current = worldPt;
      beginDraw(worldPt);
    },
    [beginDraw, endDraw, getPointerWorld, getScreenPoint, tool],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const screenPt = getScreenPoint(e.clientX, e.clientY);
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, screenPt);
      }

      // Touch has no hover concept — a finger already shows its own position.
      if (e.pointerType === "mouse") {
        lastScreenPosRef.current = screenPt;
        updateCursorOverlay();
      }

      if (isPanningRef.current) {
        const { width, height } = viewportRef.current;
        if (activePointersRef.current.size >= 2) {
          const pts = [...activePointersRef.current.values()];
          const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
          const dist = distance(pts[0], pts[1]);
          if (lastPanScreenRef.current) {
            cameraRef.current = panBy(
              cameraRef.current,
              mid.x - lastPanScreenRef.current.x,
              mid.y - lastPanScreenRef.current.y,
            );
          }
          if (pinchStartRef.current && pinchStartRef.current.dist > 0) {
            const targetZoom = clampZoom(
              pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist),
            );
            const factor = targetZoom / cameraRef.current.zoom;
            cameraRef.current = zoomAt(cameraRef.current, factor, mid.x, mid.y, width, height);
          }
          lastPanScreenRef.current = mid;
        } else if (lastPanScreenRef.current) {
          cameraRef.current = panBy(
            cameraRef.current,
            screenPt.x - lastPanScreenRef.current.x,
            screenPt.y - lastPanScreenRef.current.y,
          );
          lastPanScreenRef.current = screenPt;
        }
        scheduleRedraw({ world: true, strokes: true });
        lastCursorWorldRef.current = getPointerWorld(e.clientX, e.clientY);
        return;
      }

      if (zoomDragRef.current) {
        const { startScreen, startZoom } = zoomDragRef.current;
        const deltaY = startScreen.y - screenPt.y; // drag up = zoom in
        const targetZoom = clampZoom(startZoom * Math.pow(1.006, deltaY));
        const factor = targetZoom / cameraRef.current.zoom;
        const { width, height } = viewportRef.current;
        cameraRef.current = zoomAt(cameraRef.current, factor, startScreen.x, startScreen.y, width, height);
        scheduleRedraw({ world: true, strokes: true });
        lastCursorWorldRef.current = getPointerWorld(e.clientX, e.clientY);
        return;
      }

      if (drawBufferRef.current) {
        const worldPt = getPointerWorld(e.clientX, e.clientY);
        lastCursorWorldRef.current = worldPt;
        continueDraw(worldPt);
        return;
      }

      lastCursorWorldRef.current = getPointerWorld(e.clientX, e.clientY);
    },
    [continueDraw, getPointerWorld, getScreenPoint, scheduleRedraw, updateCursorOverlay],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size === 0) {
        isPanningRef.current = false;
        lastPanScreenRef.current = null;
        pinchStartRef.current = null;
        zoomDragRef.current = null;
        endDraw();
      } else if (activePointersRef.current.size === 1 && isPanningRef.current) {
        lastPanScreenRef.current = [...activePointersRef.current.values()][0];
        pinchStartRef.current = null;
      }
    },
    [endDraw],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      handlePointerUp(e);
      hideCursorOverlay();
    },
    [handlePointerUp, hideCursorOverlay],
  );

  const resetView = useCallback(() => {
    cameraRef.current = defaultCamera(WORLD_WIDTH, WORLD_HEIGHT);
    scheduleRedraw({ world: true, strokes: true });
  }, [scheduleRedraw]);

  const zoomButton = useCallback(
    (factor: number) => {
      const { width, height } = viewportRef.current;
      cameraRef.current = zoomAt(cameraRef.current, factor, width / 2, height / 2, width, height);
      scheduleRedraw({ world: true, strokes: true });
    },
    [scheduleRedraw],
  );

  return (
    <div className="relative h-dvh w-dvw touch-none overflow-hidden select-none bg-chrome-bg">
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={worldCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full touch-none ${
            tool === "pan"
              ? "cursor-grab active:cursor-grabbing"
              : tool === "zoom"
                ? "cursor-ns-resize"
                : "cursor-none"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
        <BrushCursor ref={cursorElRef} tool={tool} brushType={brushType} color={color} />
      </div>

      <RemoteCursors
        entries={presenceList ?? []}
        selfClientId={clientId}
        camera={cameraSnapshot}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
      />

      {!replayDone && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-chrome-bg/80">
          <span className="font-mono text-sm tracking-wide text-ink-dim">
            loading the wall
            <span className="animate-pulse text-accent-green">…</span>
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b-2 border-rust/70 bg-chrome-bg/95 px-4 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-sm">
        <ChromeRivet className="top-1/2 left-2 -translate-y-1/2" />
        <div className="pointer-events-auto flex items-center gap-2 pl-4">
          <span className="stencil-cut font-display text-sm font-bold tracking-[0.22em] text-ink uppercase">
            AlwaysDraw
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 pr-4">
          <ThemeToggle />
          <ConnectionStatus />
          <OnlineCount count={onlineCount ?? 0} />
        </div>
        <ChromeRivet className="top-1/2 right-2 -translate-y-1/2" />
      </div>

      {submitError && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2">
          <div className="rounded-sm border border-accent-crimson-deep bg-chrome-bg-raised px-3 py-1.5 text-xs text-ink shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {submitError}
          </div>
        </div>
      )}

      <DrawingToolbar
        tool={tool}
        onToolChange={setTool}
        brushType={brushType}
        onBrushTypeChange={setBrushType}
        color={color}
        onColorChange={setColor}
        width={brushWidth}
        onWidthChange={setBrushWidth}
        opacity={opacity}
        onOpacityChange={setOpacity}
        zoomPercent={zoomPercent}
        onZoomIn={() => zoomButton(1.2)}
        onZoomOut={() => zoomButton(1 / 1.2)}
        onResetView={resetView}
      />
    </div>
  );
}
