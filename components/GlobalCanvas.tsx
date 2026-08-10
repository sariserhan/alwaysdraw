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
import { screenToWorld, clampToWorld, isWithinWorld } from "@/lib/coordinates";
import { clearCanvas, drawWorldBackground, drawStroke } from "@/lib/drawing";
import { renderBrushStroke } from "@/lib/brushes";
import { StrokeBuffer } from "@/lib/strokeBuffer";
import { getClientId } from "@/lib/identity";
import { type ShapeType, buildShapePoints } from "@/lib/shapes";
import { parseCameraFromSearch, cameraToSearchString } from "@/lib/viewportUrl";
import type { LocalStroke, ServerStroke, Point, Tool, BrushType } from "@/lib/types";
import { DrawingToolbar } from "./DrawingToolbar";
import { OnlineCount } from "./OnlineCount";
import { ConnectionStatus } from "./ConnectionStatus";
import { RemoteCursors } from "./RemoteCursors";
import { ThemeToggle } from "./ThemeToggle";
import { ChromeRivet } from "./ChromeRivet";
import { BrushCursor } from "./BrushCursor";
import { MagnifierLoupe } from "./MagnifierLoupe";
import { RulerOverlay } from "./RulerOverlay";

const MIN_CURSOR_DIAMETER_PX = 4;
const MAGNIFIER_SIZE_PX = 160;
const MAGNIFIER_FACTOR = 2.5;
const MAGNIFIER_OFFSET_PX = 24;
// A drag shorter than this (world px) is treated as an accidental click, not a shape.
const MIN_SHAPE_DRAG = 2;
const SHAPE_BRUSH_TYPE: BrushType = "brush";

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
  const magnifierElRef = useRef<HTMLCanvasElement>(null);
  const rulerElRef = useRef<HTMLDivElement>(null);
  const lastScreenPosRef = useRef<Point | null>(null);
  const shapeDragRef = useRef<{ start: Point; current: Point } | null>(null);
  const shapePreviewRef = useRef<LocalStroke | null>(null);
  const rulerDragRef = useRef<{
    startWorld: Point;
    startScreen: Point;
    currentWorld: Point;
    currentScreen: Point;
  } | null>(null);

  const [clientId] = useState(() => getClientId());
  // Deep link: a shared URL's ?x=&y=&z= seeds the initial view, if present/valid.
  // Computed once as a plain value (not read from a ref) so it can seed both
  // the ref below and the lazy useState initializers without a render-time ref read.
  const initialCamera =
    parseCameraFromSearch(window.location.search) ?? defaultCamera(WORLD_WIDTH, WORLD_HEIGHT);
  const cameraRef = useRef<Camera>(initialCamera);
  const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRef = useRef({ width: 0, height: 0 });

  const committedRef = useRef<ServerStroke[]>([]);
  const appliedIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, LocalStroke>>(new Map());
  const [replayDone, setReplayDone] = useState(false);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushType, setBrushType] = useState<BrushType>("brush");
  const [shapeType, setShapeType] = useState<ShapeType>("line");
  const [color, setColor] = useState("#17181a");
  const [brushWidth, setBrushWidth] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(() => Math.round(initialCamera.zoom * 100));
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Snapshots of ref-held values, synced (in effects/callbacks, never during
  // render) only when something that must re-render RemoteCursors happens.
  const [cameraSnapshot, setCameraSnapshot] = useState<Camera>(() => initialCamera);
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
    if (shapePreviewRef.current) paintOneStroke(ctx, width, height, shapePreviewRef.current);
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
    const canvas = canvasRef.current;
    const isBrushTool = tool === "brush" || tool === "eraser";

    if (!isBrushTool || !pos) {
      if (el) el.style.display = "none";
      // Let the Tailwind class (grab/crosshair/default) drive the cursor again.
      if (canvas) canvas.style.cursor = "";
      return;
    }

    // Off the wall (the void beyond the world bounds at low zoom / panned to
    // an edge) gets the plain OS cursor back — nothing to draw on out there.
    const { width, height } = viewportRef.current;
    const worldPt = screenToWorld(pos.x, pos.y, cameraRef.current, width, height);
    const onWall = isWithinWorld(worldPt);
    if (canvas) canvas.style.cursor = onWall ? "" : "default";

    if (!el) return;
    if (!onWall) {
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

  // Loupe: a circular zoomed-in crop of the world+strokes canvases around the
  // cursor, redrawn on every pointer move while the Magnifier tool is active.
  // Camera doesn't move — this is purely an inspection preview.
  const updateMagnifier = useCallback(() => {
    const el = magnifierElRef.current;
    const pos = lastScreenPosRef.current;
    if (!el) return;
    if (!pos || tool !== "magnifier") {
      el.style.display = "none";
      return;
    }
    const worldCanvas = worldCanvasRef.current;
    const strokesCanvas = canvasRef.current;
    if (!worldCanvas || !strokesCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    const backingSize = Math.round(MAGNIFIER_SIZE_PX * dpr);
    if (el.width !== backingSize || el.height !== backingSize) {
      el.width = backingSize;
      el.height = backingSize;
    }
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const sourceRadius = MAGNIFIER_SIZE_PX / (2 * MAGNIFIER_FACTOR);
    const sx = (pos.x - sourceRadius) * dpr;
    const sy = (pos.y - sourceRadius) * dpr;
    const sSize = sourceRadius * 2 * dpr;

    ctx.clearRect(0, 0, backingSize, backingSize);
    ctx.drawImage(worldCanvas, sx, sy, sSize, sSize, 0, 0, backingSize, backingSize);
    ctx.drawImage(strokesCanvas, sx, sy, sSize, sSize, 0, 0, backingSize, backingSize);

    el.style.width = `${MAGNIFIER_SIZE_PX}px`;
    el.style.height = `${MAGNIFIER_SIZE_PX}px`;

    const { width: vw, height: vh } = viewportRef.current;
    let left = pos.x + MAGNIFIER_OFFSET_PX;
    let top = pos.y - MAGNIFIER_OFFSET_PX - MAGNIFIER_SIZE_PX;
    if (left + MAGNIFIER_SIZE_PX > vw) left = pos.x - MAGNIFIER_OFFSET_PX - MAGNIFIER_SIZE_PX;
    if (top < 0) top = Math.min(pos.y + MAGNIFIER_OFFSET_PX, vh - MAGNIFIER_SIZE_PX);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.display = "block";
  }, [tool]);

  useEffect(() => {
    updateMagnifier();
  }, [updateMagnifier]);

  // Ruler: dashed line + distance label between drag start/end, in world px.
  // Purely an inspection overlay — never submitted as a stroke.
  const updateRuler = useCallback(() => {
    const el = rulerElRef.current;
    const drag = rulerDragRef.current;
    if (!el) return;
    if (!drag) {
      el.style.display = "none";
      return;
    }
    const line = el.querySelector<SVGLineElement>("[data-ruler-line]");
    const label = el.querySelector<HTMLSpanElement>("[data-ruler-label]");
    if (!line || !label) return;
    line.setAttribute("x1", String(drag.startScreen.x));
    line.setAttribute("y1", String(drag.startScreen.y));
    line.setAttribute("x2", String(drag.currentScreen.x));
    line.setAttribute("y2", String(drag.currentScreen.y));
    const dist = Math.round(distance(drag.startWorld, drag.currentWorld));
    label.textContent = `${dist} px`;
    label.style.left = `${(drag.startScreen.x + drag.currentScreen.x) / 2}px`;
    label.style.top = `${(drag.startScreen.y + drag.currentScreen.y) / 2}px`;
    el.style.display = "block";
  }, []);

  useEffect(() => {
    if (tool !== "ruler") rulerDragRef.current = null;
    updateRuler();
  }, [tool, updateRuler]);

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
          // Debounced so a pan/zoom gesture doesn't hammer the History API —
          // only the settled view ends up shareable via the address bar.
          if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
          urlSyncTimerRef.current = setTimeout(() => {
            const qs = cameraToSearchString(cameraRef.current);
            window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
          }, 400);
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
        updateMagnifier();
      });
    },
    [redrawWorld, redrawStrokes, updateCursorOverlay, updateMagnifier],
  );

  const hideCursorOverlay = useCallback(() => {
    lastScreenPosRef.current = null;
    if (cursorElRef.current) cursorElRef.current.style.display = "none";
    if (magnifierElRef.current) magnifierElRef.current.style.display = "none";
    rulerDragRef.current = null;
    if (rulerElRef.current) rulerElRef.current.style.display = "none";
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

      if (tool === "magnifier") return;

      const worldPt = getPointerWorld(e.clientX, e.clientY);
      lastCursorWorldRef.current = worldPt;

      if (tool === "shape") {
        shapeDragRef.current = { start: worldPt, current: worldPt };
        return;
      }

      if (tool === "ruler") {
        rulerDragRef.current = {
          startWorld: worldPt,
          startScreen: screenPt,
          currentWorld: worldPt,
          currentScreen: screenPt,
        };
        updateRuler();
        return;
      }

      beginDraw(worldPt);
    },
    [beginDraw, endDraw, getPointerWorld, getScreenPoint, tool, updateRuler],
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
        updateMagnifier();
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

      if (shapeDragRef.current) {
        const worldPt = getPointerWorld(e.clientX, e.clientY);
        shapeDragRef.current.current = worldPt;
        shapePreviewRef.current = {
          clientStrokeId: "preview",
          clientId,
          mode: "draw",
          brushType: SHAPE_BRUSH_TYPE,
          color,
          width: brushWidth,
          opacity,
          points: buildShapePoints(shapeType, shapeDragRef.current.start, worldPt),
          clientTimestamp: 0,
        };
        scheduleRedraw({ strokes: true });
        lastCursorWorldRef.current = worldPt;
        return;
      }

      if (rulerDragRef.current) {
        const worldPt = getPointerWorld(e.clientX, e.clientY);
        rulerDragRef.current.currentWorld = worldPt;
        rulerDragRef.current.currentScreen = screenPt;
        updateRuler();
        lastCursorWorldRef.current = worldPt;
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
    [
      continueDraw,
      getPointerWorld,
      getScreenPoint,
      scheduleRedraw,
      updateCursorOverlay,
      updateMagnifier,
      updateRuler,
      clientId,
      color,
      brushWidth,
      opacity,
      shapeType,
    ],
  );

  const finalizeShape = useCallback(() => {
    const drag = shapeDragRef.current;
    shapeDragRef.current = null;
    shapePreviewRef.current = null;
    if (!drag) return;
    if (distance(drag.start, drag.current) < MIN_SHAPE_DRAG) {
      scheduleRedraw({ strokes: true });
      return;
    }
    const points = buildShapePoints(shapeType, drag.start, drag.current);
    const buffer = new StrokeBuffer(clientId, "draw", SHAPE_BRUSH_TYPE, color, brushWidth, opacity, commitOwnChunk);
    for (const p of points) buffer.addPoint(p);
    buffer.finish();
    scheduleRedraw({ strokes: true });
  }, [scheduleRedraw, shapeType, clientId, color, brushWidth, opacity, commitOwnChunk]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size === 0) {
        isPanningRef.current = false;
        lastPanScreenRef.current = null;
        pinchStartRef.current = null;
        endDraw();
        finalizeShape();
        // Ruler is a transient measurement, not a frozen readout — release
        // ends it, same as releasing a shape drag ends that.
        if (rulerDragRef.current) {
          rulerDragRef.current = null;
          updateRuler();
        }
      } else if (activePointersRef.current.size === 1 && isPanningRef.current) {
        lastPanScreenRef.current = [...activePointersRef.current.values()][0];
        pinchStartRef.current = null;
      }
    },
    [endDraw, finalizeShape, updateRuler],
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

  // Reads cameraRef directly (not the debounced address bar) so the copied
  // link always matches the view on screen right now, not up to 400ms stale.
  const handleShare = useCallback(async () => {
    const qs = cameraToSearchString(cameraRef.current);
    const url = `${window.location.origin}${window.location.pathname}?${qs}`;
    await navigator.clipboard.writeText(url);
  }, []);

  return (
    <div className="relative h-dvh w-dvw touch-none overflow-hidden select-none bg-chrome-bg">
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={worldCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full touch-none ${
            tool === "pan"
              ? "cursor-grab active:cursor-grabbing"
              : tool === "magnifier"
                ? "cursor-default"
                : tool === "shape" || tool === "ruler"
                  ? "cursor-crosshair"
                  : "cursor-none"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
        <BrushCursor ref={cursorElRef} tool={tool} brushType={brushType} color={color} />
        <MagnifierLoupe ref={magnifierElRef} />
        <RulerOverlay ref={rulerElRef} />
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

      <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between border-b-2 border-rust/70 bg-chrome-bg/95 px-4 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-sm">
        <ChromeRivet className="top-1/2 left-2 -translate-y-1/2" />
        <div className="flex items-center gap-2 pl-4">
          <span className="stencil-cut font-display text-sm font-bold tracking-[0.22em] text-ink uppercase">
            AlwaysDraw
          </span>
        </div>
        <div className="flex items-center gap-2 pr-4">
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
        shapeType={shapeType}
        onShapeTypeChange={setShapeType}
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
        onShare={handleShare}
      />
    </div>
  );
}
