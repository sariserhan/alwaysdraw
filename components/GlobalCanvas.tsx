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
import {
  clearCanvas,
  drawWorldBackground,
  drawStroke,
  fillMiniMapBackground,
  paintMiniMapStrokes,
  drawHeatmapOverlay,
} from "@/lib/drawing";
import {
  createHeatmapGrid,
  addStrokesToHeatmap,
  maxHeatmapCount,
  findBusiestCell,
  findRandomActiveCell,
  findLatestStrokeCenter,
} from "@/lib/heatmap";
import { renderBrushStroke } from "@/lib/brushes";
import { StrokeBuffer } from "@/lib/strokeBuffer";
import { getClientId } from "@/lib/identity";
import { type ShapeType, buildShapePoints } from "@/lib/shapes";
import { parseCameraFromSearch, cameraToSearchString } from "@/lib/viewportUrl";
import { captureEvent, captureOperationalError } from "@/lib/observability";
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
import { MiniMap, MINI_MAP_SIZE_PX } from "./MiniMap";
import { ReplayBar } from "./ReplayBar";
import { SpatialDiscoveryMenu } from "./SpatialDiscoveryMenu";

const MIN_CURSOR_DIAMETER_PX = 4;
const MAGNIFIER_SIZE_PX = 160;
const MAGNIFIER_FACTOR = 2.5;
const MAGNIFIER_OFFSET_PX = 24;
const MIN_SHAPE_DRAG = 2;
const REPLAY_PAGE_SIZE = 1000;
const HEATMAP_GRID_SIZE = 32;

export function GlobalCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldCanvasRef = useRef<HTMLCanvasElement>(null);
  const worldCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const heatmapGridRef = useRef(createHeatmapGrid(HEATMAP_GRID_SIZE));
  const cursorElRef = useRef<HTMLDivElement>(null);
  const magnifierElRef = useRef<HTMLCanvasElement>(null);
  const rulerElRef = useRef<HTMLDivElement>(null);
  const miniMapCanvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const miniMapViewportRectRef = useRef<HTMLDivElement>(null);
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
  const initialCamera =
    parseCameraFromSearch(window.location.search) ?? defaultCamera(WORLD_WIDTH, WORLD_HEIGHT);
  const cameraRef = useRef<Camera>(initialCamera);
  const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRef = useRef({ width: 0, height: 0 });

  const committedRef = useRef<ServerStroke[]>([]);
  const appliedIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, LocalStroke>>(new Map());
  const replayStartedAtRef = useRef<number | null>(null);
  const firstMarkTrackedRef = useRef(false);
  const [replayDone, setReplayDone] = useState(false);
  const [replayError, setReplayError] = useState(false);
  const [liveTailCursor, setLiveTailCursor] = useState<number | null>(null);

  // Time Travel Replay state
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [replaySequenceIndex, setReplaySequenceIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushType, setBrushType] = useState<BrushType>("brush");
  const [shapeType, setShapeType] = useState<ShapeType>("line");
  const [color, setColor] = useState("#17181a");
  const [brushWidth, setBrushWidth] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(() => Math.round(initialCamera.zoom * 100));
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cameraSnapshot, setCameraSnapshot] = useState<Camera>(() => initialCamera);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const convex = useConvex();
  const submitStroke = useMutation(api.strokes.submit);
  const heartbeat = useMutation(api.presence.heartbeat);

  const onlineCount = useQuery(api.presence.onlineCount);
  const presenceList = useQuery(api.presence.list);
  const liveTail = useQuery(
    api.strokes.listSince,
    liveTailCursor === null ? "skip" : { afterSequence: liveTailCursor },
  );

  const [maxSequence, setMaxSequence] = useState(0);

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

  const redrawHeatmap = useCallback(() => {
    const ctx = heatmapCtxRef.current;
    if (!ctx) return;
    const { width, height } = viewportRef.current;
    clearCanvas(ctx, width, height);
    if (!showHeatmap) return;
    const grid = heatmapGridRef.current;
    drawHeatmapOverlay(
      ctx,
      grid,
      maxHeatmapCount(grid),
      cameraRef.current,
      width,
      height,
      WORLD_WIDTH,
      WORLD_HEIGHT,
    );
  }, [showHeatmap]);

  useEffect(() => {
    redrawHeatmap();
  }, [redrawHeatmap]);

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

    const maxSeqFilter = isReplayMode ? replaySequenceIndex : Infinity;

    for (const s of committedRef.current) {
      if (s.sequence <= maxSeqFilter) {
        paintOneStroke(ctx, width, height, s);
      }
    }
    if (!isReplayMode) {
      for (const s of pendingRef.current.values()) paintOneStroke(ctx, width, height, s);
      if (shapePreviewRef.current) paintOneStroke(ctx, width, height, shapePreviewRef.current);
    }
  }, [paintOneStroke, isReplayMode, replaySequenceIndex]);

  // Replay animation loop
  useEffect(() => {
    if (!isReplayMode || !isPlayingReplay) return;

    const interval = setInterval(() => {
      setReplaySequenceIndex((prev) => {
        const next = prev + playbackSpeed * 2;
        if (next >= maxSequence) {
          setIsPlayingReplay(false);
          return maxSequence;
        }
        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [isReplayMode, isPlayingReplay, playbackSpeed, maxSequence]);

  useEffect(() => {
    if (isReplayMode) {
      redrawStrokes();
    }
  }, [isReplayMode, replaySequenceIndex, redrawStrokes]);

  const updateCursorOverlay = useCallback(() => {
    const el = cursorElRef.current;
    const pos = lastScreenPosRef.current;
    const canvas = canvasRef.current;
    const isBrushTool = tool === "brush" || tool === "eraser";

    if (!isBrushTool || !pos) {
      if (el) el.style.display = "none";
      if (canvas) canvas.style.cursor = "";
      return;
    }

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

  const updateMiniMapViewportRect = useCallback(() => {
    const el = miniMapViewportRectRef.current;
    if (!el) return;
    const { width, height } = viewportRef.current;
    const camera = cameraRef.current;
    const scaleX = MINI_MAP_SIZE_PX / WORLD_WIDTH;
    const scaleY = MINI_MAP_SIZE_PX / WORLD_HEIGHT;
    const worldVisibleW = width / camera.zoom;
    const worldVisibleH = height / camera.zoom;
    el.style.left = `${(camera.x - worldVisibleW / 2) * scaleX}px`;
    el.style.top = `${(camera.y - worldVisibleH / 2) * scaleY}px`;
    el.style.width = `${Math.max(2, worldVisibleW * scaleX)}px`;
    el.style.height = `${Math.max(2, worldVisibleH * scaleY)}px`;
  }, []);

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
          redrawHeatmap();
          dirtyRef.current.world = false;
          updateMiniMapViewportRect();
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
    [redrawWorld, redrawStrokes, redrawHeatmap, updateCursorOverlay, updateMagnifier, updateMiniMapViewportRect],
  );

  const hideCursorOverlay = useCallback(() => {
    lastScreenPosRef.current = null;
    if (cursorElRef.current) cursorElRef.current.style.display = "none";
    if (magnifierElRef.current) magnifierElRef.current.style.display = "none";
    rulerDragRef.current = null;
    if (rulerElRef.current) rulerElRef.current.style.display = "none";
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const worldCanvas = worldCanvasRef.current;
    const heatmapCanvas = heatmapCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !worldCanvas || !heatmapCanvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      viewportRef.current = { width: rect.width, height: rect.height };
      setViewportSize({ width: rect.width, height: rect.height });
      for (const c of [canvas, worldCanvas, heatmapCanvas]) {
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
      const heatmapCtx = heatmapCanvas.getContext("2d");
      if (heatmapCtx) {
        heatmapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        heatmapCtxRef.current = heatmapCtx;
      }
      redrawWorld();
      redrawStrokes();
      redrawHeatmap();

      const miniMap = miniMapCanvasRef.current;
      if (miniMap) {
        const miniMapSize = Math.round(MINI_MAP_SIZE_PX * dpr);
        if (miniMap.width !== miniMapSize || miniMap.height !== miniMapSize) {
          miniMap.width = miniMapSize;
          miniMap.height = miniMapSize;
          const miniMapCtx = miniMap.getContext("2d");
          if (miniMapCtx) {
            miniMapCtxRef.current = miniMapCtx;
            fillMiniMapBackground(miniMapCtx, miniMapSize);
            paintMiniMapStrokes(miniMapCtx, committedRef.current, miniMapSize, WORLD_WIDTH, WORLD_HEIGHT);
          }
        }
      }
      updateMiniMapViewportRect();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawWorld, redrawStrokes, redrawHeatmap, updateMiniMapViewportRect]);

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

  // Snapshot-assisted fast loading + initial replay
  useEffect(() => {
    let cancelled = false;
    replayStartedAtRef.current = performance.now();
    async function replay() {
      let after = 0;
      let total = 0;
      try {
        // Step 1: Check for latest snapshot to seed initial sequence
        const latestSnapshot = await convex.query(api.snapshots.getLatest);
        if (latestSnapshot && latestSnapshot.sequence > 0) {
          after = latestSnapshot.sequence;
        }

        // Step 2: Fetch remaining delta strokes since snapshot
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
          if (page.length < REPLAY_PAGE_SIZE) break;
        }
        if (!cancelled) {
          setReplayDone(true);
          setLiveTailCursor(after);
          setMaxSequence(after);
          if (miniMapCtxRef.current && miniMapCanvasRef.current) {
            paintMiniMapStrokes(
              miniMapCtxRef.current,
              committedRef.current,
              miniMapCanvasRef.current.width,
              WORLD_WIDTH,
              WORLD_HEIGHT,
            );
          }
          addStrokesToHeatmap(heatmapGridRef.current, committedRef.current, WORLD_WIDTH, WORLD_HEIGHT);
          redrawHeatmap();
          captureEvent("wall_loaded", {
            duration_ms: Math.round(
              performance.now() - (replayStartedAtRef.current ?? performance.now()),
            ),
            stroke_chunks: total,
            snapshot_used: !!latestSnapshot,
          });
          scheduleRedraw();
        }
      } catch (error) {
        if (!cancelled) {
          setReplayError(true);
          captureOperationalError(error, "initial_replay", { stroke_chunks: total });
        }
      }
    }
    replay();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!replayDone || !liveTail || liveTail.length === 0) return;
    queueMicrotask(() => {
      const newlyApplied: ServerStroke[] = [];
      for (const s of liveTail) {
        if (appliedIdsRef.current.has(s.clientStrokeId)) continue;
        appliedIdsRef.current.add(s.clientStrokeId);
        pendingRef.current.delete(s.clientStrokeId);
        committedRef.current.push(s);
        newlyApplied.push(s);
      }
      const lastSeq = liveTail[liveTail.length - 1].sequence;
      setMaxSequence(lastSeq);
      if (newlyApplied.length > 0) {
        scheduleRedraw();
        if (miniMapCtxRef.current && miniMapCanvasRef.current) {
          paintMiniMapStrokes(
            miniMapCtxRef.current,
            newlyApplied,
            miniMapCanvasRef.current.width,
            WORLD_WIDTH,
            WORLD_HEIGHT,
          );
        }
        addStrokesToHeatmap(heatmapGridRef.current, newlyApplied, WORLD_WIDTH, WORLD_HEIGHT);
        redrawHeatmap();
      }
      setLiveTailCursor(lastSeq);
    });
  }, [liveTail, replayDone, scheduleRedraw, redrawHeatmap]);

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

  const commitOwnChunk = useCallback(
    (chunk: LocalStroke) => {
      if (!firstMarkTrackedRef.current) {
        firstMarkTrackedRef.current = true;
        captureEvent("first_mark", { mode: chunk.mode, brush: chunk.brushType });
      }
      pendingRef.current.set(chunk.clientStrokeId, chunk);
      submitStroke(chunk).catch((err) => {
        console.error("stroke submit rejected", err);
        captureOperationalError(err, "stroke_submit", { mode: chunk.mode });
        pendingRef.current.delete(chunk.clientStrokeId);
        setSubmitError("a mark didn't stick — try again");
        scheduleRedraw({ strokes: true });
      });
    },
    [scheduleRedraw, submitStroke],
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

      if (activePointersRef.current.size > 1) return;

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
            const factor = dist / pinchStartRef.current.dist;
            const targetZoom = clampZoom(pinchStartRef.current.zoom * factor);
            cameraRef.current = zoomAt(cameraRef.current, targetZoom / cameraRef.current.zoom, mid.x, mid.y, width, height);
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
        return;
      }

      if (tool === "magnifier") return;

      const worldPt = getPointerWorld(e.clientX, e.clientY);
      lastCursorWorldRef.current = worldPt;

      if (tool === "shape") {
        const drag = shapeDragRef.current;
        if (!drag) return;
        drag.current = worldPt;
        const pts = buildShapePoints(shapeType, drag.start, drag.current);
        shapePreviewRef.current =
          pts.length >= 2
            ? {
                clientStrokeId: "preview-shape",
                clientId,
                mode: "draw",
                brushType: "brush",
                color,
                width: brushWidth,
                opacity,
                points: pts,
                clientTimestamp: Date.now(),
              }
            : null;
        scheduleRedraw({ strokes: true });
        return;
      }

      if (tool === "ruler") {
        const drag = rulerDragRef.current;
        if (!drag) return;
        drag.currentWorld = worldPt;
        drag.currentScreen = screenPt;
        updateRuler();
        return;
      }

      continueDraw(worldPt);
    },
    [continueDraw, getPointerWorld, getScreenPoint, scheduleRedraw, tool, shapeType, color, brushWidth, opacity, clientId, updateCursorOverlay, updateMagnifier, updateRuler],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointersRef.current.delete(e.pointerId);

      if (tool === "shape") {
        const drag = shapeDragRef.current;
        shapeDragRef.current = null;
        shapePreviewRef.current = null;
        if (drag && distance(drag.start, drag.current) >= MIN_SHAPE_DRAG) {
          const pts = buildShapePoints(shapeType, drag.start, drag.current);
          if (pts.length >= 2) {
            const buffer = new StrokeBuffer(
              clientId,
              "draw",
              "brush",
              color,
              brushWidth,
              opacity,
              commitOwnChunk,
            );
            for (const p of pts) buffer.addPoint(p);
            buffer.finish();
          }
        }
        scheduleRedraw({ strokes: true });
      }

      if (tool === "ruler") {
        rulerDragRef.current = null;
        updateRuler();
      }

      if (activePointersRef.current.size === 0) {
        isPanningRef.current = false;
        lastPanScreenRef.current = null;
        pinchStartRef.current = null;
        endDraw();
      } else if (activePointersRef.current.size === 1) {
        const remaining = [...activePointersRef.current.values()][0];
        lastPanScreenRef.current = remaining;
      }
    },
    [endDraw, tool, shapeType, color, brushWidth, opacity, clientId, commitOwnChunk, scheduleRedraw, updateRuler],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      hideCursorOverlay();
      handlePointerUp(e);
    },
    [handlePointerUp, hideCursorOverlay],
  );

  const resetView = useCallback(() => {
    cameraRef.current = defaultCamera(WORLD_WIDTH, WORLD_HEIGHT);
    scheduleRedraw({ world: true, strokes: true });
    captureEvent("camera_reset");
  }, [scheduleRedraw]);

  const zoomButton = useCallback(
    (factor: number) => {
      const { width, height } = viewportRef.current;
      cameraRef.current = zoomAt(cameraRef.current, factor, width / 2, height / 2, width, height);
      scheduleRedraw({ world: true, strokes: true });
      captureEvent("zoom_button", { factor });
    },
    [scheduleRedraw],
  );

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?${cameraToSearchString(cameraRef.current)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    captureEvent("view_shared");
  }, []);

  const handleToolChange = useCallback((nextTool: Tool) => {
    setTool(nextTool);
    captureEvent("tool_selected", { tool: nextTool });
  }, []);

  const handleMiniMapJump = useCallback(
    (fracX: number, fracY: number) => {
      const target = clampToWorld({ x: fracX * WORLD_WIDTH, y: fracY * WORLD_HEIGHT });
      cameraRef.current = { ...cameraRef.current, x: target.x, y: target.y };
      scheduleRedraw({ world: true, strokes: true });
    },
    [scheduleRedraw],
  );

  const handleToggleHeatmap = useCallback(() => {
    setShowHeatmap((v) => {
      captureEvent("heatmap_toggled", { shown: !v });
      return !v;
    });
  }, []);

  const handleJumpToBusiest = useCallback(() => {
    const cell = findBusiestCell(heatmapGridRef.current, WORLD_WIDTH, WORLD_HEIGHT);
    if (!cell) return;
    cameraRef.current = { ...cameraRef.current, x: cell.x, y: cell.y };
    scheduleRedraw({ world: true, strokes: true });
    captureEvent("jumped_to_busiest");
  }, [scheduleRedraw]);

  // Spatial Teleportation Handlers
  const handleJumpToPoint = useCallback((pt: Point, label: string) => {
    const { width, height } = viewportRef.current;
    cameraRef.current = {
      x: Math.max(width / (2 * cameraRef.current.zoom), Math.min(WORLD_WIDTH - width / (2 * cameraRef.current.zoom), pt.x)),
      y: Math.max(height / (2 * cameraRef.current.zoom), Math.min(WORLD_HEIGHT - height / (2 * cameraRef.current.zoom), pt.y)),
      zoom: cameraRef.current.zoom,
    };
    scheduleRedraw({ world: true, strokes: true });
    captureEvent("spatial_teleport", { label });
  }, [scheduleRedraw]);

  const getBusiestPoint = useCallback(() => {
    return findBusiestCell(heatmapGridRef.current, WORLD_WIDTH, WORLD_HEIGHT);
  }, []);

  const getRandomActivePoint = useCallback(() => {
    return findRandomActiveCell(heatmapGridRef.current, WORLD_WIDTH, WORLD_HEIGHT);
  }, []);

  const getLatestActivityPoint = useCallback(() => {
    return findLatestStrokeCenter(committedRef.current);
  }, []);

  return (
    <div className="relative h-dvh w-dvw touch-none overflow-hidden select-none bg-chrome-bg">
      <main id="canvas-main" className="absolute inset-0" aria-label="Shared 10,000x10,000 Drawing Canvas">
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
          <canvas ref={heatmapCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
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

        <aside id="minimap-panel" aria-label="Canvas Minimap Overview">
          <MiniMap
            canvasRef={miniMapCanvasRef}
            viewportRectRef={miniMapViewportRectRef}
            onJump={handleMiniMapJump}
          />
        </aside>

        {!replayDone && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-chrome-bg/80">
            <span className="font-mono text-sm tracking-wide text-ink-dim">
              {replayError ? "the wall couldn't load — reload to try again" : "loading the wall"}
              {!replayError && <span className="animate-pulse text-accent-green">…</span>}
            </span>
          </div>
        )}
      </main>

      {/* Top Header Bar */}
      <header
        id="header-bar"
        role="banner"
        className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between border-b-2 border-rust/70 bg-chrome-bg/95 px-4 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-sm"
      >
        <ChromeRivet className="top-1/2 left-2 -translate-y-1/2" />
        <div className="flex items-center gap-2 pl-4">
          <h1 id="app-heading" className="stencil-cut font-display text-sm font-bold tracking-[0.22em] text-ink uppercase">
            AlwaysDraw
          </h1>
        </div>

        <div className="flex items-center gap-3 pr-4">
          <SpatialDiscoveryMenu
            onJumpToPoint={handleJumpToPoint}
            getBusiestPoint={getBusiestPoint}
            getRandomActivePoint={getRandomActivePoint}
            getLatestActivityPoint={getLatestActivityPoint}
          />
          <ThemeToggle />
          <ConnectionStatus />
          <OnlineCount count={onlineCount ?? 0} />
        </div>
        <ChromeRivet className="top-1/2 right-2 -translate-y-1/2" />
      </header>

      {submitError && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2">
          <div className="rounded-sm border border-accent-crimson-deep bg-chrome-bg-raised px-3 py-1.5 text-xs text-ink shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {submitError}
          </div>
        </div>
      )}

      {/* Replay Bar Floating Overlay */}
      <div className="pointer-events-none absolute bottom-24 left-4 z-40">
        <ReplayBar
          isReplayMode={isReplayMode}
          isPlaying={isPlayingReplay}
          currentSequence={replaySequenceIndex}
          maxSequence={maxSequence}
          playbackSpeed={playbackSpeed}
          onTogglePlay={() => setIsPlayingReplay((v) => !v)}
          onSeek={(seq) => setReplaySequenceIndex(seq)}
          onStep={(delta) => setReplaySequenceIndex((prev) => Math.max(0, Math.min(maxSequence, prev + delta)))}
          onSpeedChange={setPlaybackSpeed}
          onExitReplay={() => {
            setIsReplayMode(false);
            setIsPlayingReplay(false);
          }}
          onEnterReplay={() => {
            setIsReplayMode(true);
            setReplaySequenceIndex(0);
            setIsPlayingReplay(true);
          }}
        />
      </div>

      <nav id="drawing-toolbar-nav" aria-label="Drawing Tools Toolbar">
        <DrawingToolbar
          tool={tool}
          onToolChange={handleToolChange}
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
          showHeatmap={showHeatmap}
          onToggleHeatmap={handleToggleHeatmap}
          onJumpToBusiest={handleJumpToBusiest}
        />
      </nav>
    </div>
  );
}
