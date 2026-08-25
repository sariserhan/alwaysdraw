// components/SketchbookCanvas.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH, MAX_USERNAME_LENGTH } from "@/convex/constants";
import type { StrokeMode, Point, BrushType } from "@/lib/types";
import { getClientId, getUsername, setUsername, getCachedCountryCode, setCachedCountryCode } from "@/lib/identity";
import { getCountryFlagEmoji } from "@/lib/flags";
import { drawStroke, drawSegment } from "@/lib/drawing";
import { renderBrushStroke, BRUSH_CATALOG } from "@/lib/brushes";
import { screenToWorld, worldToScreen } from "@/lib/coordinates";
import type { Camera } from "@/lib/camera";
import { zoomAt, panBy } from "@/lib/camera";
import { StrokeBuffer } from "@/lib/strokeBuffer";
import { PALETTE_PRESETS, type Palette } from "@/lib/palettes";
import { BrushCursor } from "./BrushCursor";
import { RemoteCursors, type RemoteCursorsHandle } from "./RemoteCursors";
import {
  SKETCHBOOK_PAGES,
  findRegionAt,
  regionPathData,
  type SketchbookRegion,
} from "@/lib/sketchbookPages";

const DEFAULT_WIDTH = 16;
const DEFAULT_COLOR = PALETTE_PRESETS[0].colors[2];
const DEFAULT_BRUSH: BrushType = "brush";
// ponytail: half of the server's MAX_BRUSH_WIDTH (100) — that ceiling is
// shared with the main canvas's much bigger world, where a 100px stroke
// reads as normal; on a page a few hundred units across it's a paint
// roller. Only the slider's local max moves — server validation is
// unchanged and still accepts up to MAX_BRUSH_WIDTH.
const MAX_SKETCHBOOK_WIDTH = MAX_BRUSH_WIDTH / 2;

// Zoom is a multiplier of the fit-to-viewport zoom, not an absolute value —
// the main canvas's MIN_ZOOM/MAX_ZOOM are tuned for its 20000-unit world and
// don't mean anything on a ~150-800 unit sketchbook page.
const MIN_ZOOM_FACTOR = 1;
const MAX_ZOOM_FACTOR = 6;
const HEARTBEAT_INTERVAL_MS = 3000;

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
  brushType?: BrushType;
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
  const fitZoomRef = useRef(1);
  const viewportRef = useRef({ width: 0, height: 0 });
  const regionPathsRef = useRef<Map<string, Path2D>>(new Map());
  const brushCursorElRef = useRef<HTMLDivElement>(null);
  const remoteCursorsRef = useRef<RemoteCursorsHandle>(null);

  const [tool, setTool] = useState<StrokeMode>("draw");
  const [panMode, setPanMode] = useState(false);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [brushType, setBrushType] = useState<BrushType>(DEFAULT_BRUSH);
  const [activePalette, setActivePalette] = useState<Palette>(PALETTE_PRESETS[0]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [afterSequence, setAfterSequence] = useState(0);
  const [cameraSnapshot, setCameraSnapshot] = useState<Camera>({ x: page.width / 2, y: page.height / 2, zoom: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  // clientId/username/countryCode are all read during render (the identity
  // control below, RemoteCursors' selfClientId prop) as well as inside
  // handlers — plain state is safe in both places; a ref is not safe to
  // read during render.
  const [clientId] = useState(() => getClientId());
  const [username, setUsernameState] = useState(() => getUsername());
  const [countryCode, setCountryCodeState] = useState(() => getCachedCountryCode());
  const lastCursorWorldRef = useRef<Point>({ x: page.width / 2, y: page.height / 2 });
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const heartbeat = useMutation(api.sketchbookPresence.heartbeat);
  const presenceList = useQuery(api.sketchbookPresence.list, { pageId });

  const handleUsernameChange = useCallback((name: string) => {
    setUsername(name);
    setUsernameState(getUsername());
  }, []);

  // Resolve once per browser (cached to localStorage), same as
  // GlobalCanvas's identical effect — a visitor landing directly on
  // /sketchbook without ever visiting /canvas first would otherwise never
  // get a country code resolved, and no flag would ever show for them.
  useEffect(() => {
    if (countryCode) return;
    let cancelled = false;
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data: { countryCode: string | null }) => {
        if (cancelled || !data.countryCode) return;
        setCachedCountryCode(data.countryCode);
        setCountryCodeState(data.countryCode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawStrokeClipped = useCallback((stroke: SketchbookStroke) => {
    const ctx = ctxRef.current;
    const path2d = regionPathsRef.current.get(stroke.regionId);
    if (!ctx || !path2d) return;
    const { width: vw, height: vh } = viewportRef.current;
    ctx.save();
    ctx.clip(path2d);
    if (stroke.mode === "erase") {
      drawStroke(ctx, cameraRef.current, vw, vh, stroke.points, "erase", stroke.color, stroke.width);
    } else {
      renderBrushStroke(stroke.brushType, {
        ctx,
        camera: cameraRef.current,
        viewportWidth: vw,
        viewportHeight: vh,
        points: stroke.points,
        color: stroke.color,
        width: stroke.width,
        opacity: stroke.opacity ?? 1,
      });
    }
    ctx.restore();
  }, []);

  const replayAll = useCallback(() => {
    for (const stroke of allStrokesRef.current) {
      drawStrokeClipped(stroke);
    }
  }, [drawStrokeClipped]);

  // Rebuilds the screen-space clip Path2D for every region against the
  // current camera, then replays history — any camera change (resize,
  // zoom, pan) invalidates both: a stale Path2D would clip against the old
  // scale/position, and previously-rasterized pixels don't re-project
  // themselves when the camera moves, so the canvas must be cleared and
  // redrawn from the retained world-space stroke data.
  const applyCamera = useCallback(
    (nextCamera: Camera) => {
      cameraRef.current = nextCamera;
      setCameraSnapshot(nextCamera);
      const { width: vw, height: vh } = viewportRef.current;

      const paths = new Map<string, Path2D>();
      for (const region of page.regions) {
        const screenPts = region.points.map((p) => worldToScreen(p.x, p.y, nextCamera, vw, vh));
        paths.set(region.id, new Path2D(regionPathData({ id: region.id, points: screenPts })));
      }
      regionPathsRef.current = paths;

      const ctx = ctxRef.current;
      if (ctx) {
        ctx.clearRect(0, 0, vw, vh);
        replayAll();
      }
    },
    [page, replayAll],
  );

  // Resize: track viewport size, scale the canvas backing store to
  // devicePixelRatio, fit the fixed page to the viewport — a resize always
  // resets any user zoom/pan back to fit, matching the page's original
  // single-camera behavior. Resizing the canvas element also clears its
  // bitmap, which applyCamera's replay already accounts for.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      viewportRef.current = { width: rect.width, height: rect.height };
      setViewportSize({ width: rect.width, height: rect.height });
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;

      const fitZoom = Math.min(rect.width / page.width, rect.height / page.height);
      fitZoomRef.current = fitZoom;
      applyCamera({ x: page.width / 2, y: page.height / 2, zoom: fitZoom });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Wheel: ctrlKey (trackpad pinch, or a mouse wheel held with Ctrl) zooms
  // centered on the cursor; a wheel event with a horizontal component is a
  // two-finger trackpad pan; a plain vertical-only wheel (the common mouse
  // case) also zooms. Click-drag always paints — this never touches that.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    let pendingCamera: Camera | null = null;

    const flush = () => {
      rafId = null;
      if (pendingCamera) applyCamera(pendingCamera);
      pendingCamera = null;
    };

    const schedule = (next: Camera) => {
      pendingCamera = next;
      if (rafId === null) rafId = requestAnimationFrame(flush);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const base = pendingCamera ?? cameraRef.current;
      if (e.ctrlKey || e.deltaX === 0) {
        // e.offsetX/Y are relative to whichever child element is under the
        // cursor (could be a toolbar button), not this container — derive
        // the zoom-center point from the container's own rect instead.
        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const factor = Math.pow(0.998, e.deltaY);
        const minZoom = fitZoomRef.current * MIN_ZOOM_FACTOR;
        const maxZoom = fitZoomRef.current * MAX_ZOOM_FACTOR;
        const zoomed = zoomAt(base, factor, screenX, screenY, viewportRef.current.width, viewportRef.current.height);
        schedule({ ...zoomed, zoom: Math.min(maxZoom, Math.max(minZoom, zoomed.zoom)) });
      } else {
        schedule(panBy(base, -e.deltaX, -e.deltaY));
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [applyCamera]);

  const zoomButton = useCallback(
    (factor: number) => {
      const { width: vw, height: vh } = viewportRef.current;
      const minZoom = fitZoomRef.current * MIN_ZOOM_FACTOR;
      const maxZoom = fitZoomRef.current * MAX_ZOOM_FACTOR;
      const zoomed = zoomAt(cameraRef.current, factor, vw / 2, vh / 2, vw, vh);
      applyCamera({ ...zoomed, zoom: Math.min(maxZoom, Math.max(minZoom, zoomed.zoom)) });
    },
    [applyCamera],
  );

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

  // username/countryCode change independently of the heartbeat cadence
  // (a name edit, the one-time geo resolution below) — read them from a
  // ref inside the interval rather than depending on the state directly,
  // so a change is picked up by the next tick without tearing down and
  // restarting the interval (and firing an extra immediate heartbeat) on
  // every change, the way including them in the effect's deps would.
  const identityRef = useRef({ username, countryCode });
  useEffect(() => {
    identityRef.current = { username, countryCode };
  }, [username, countryCode]);

  // Broadcast this client's cursor position/identity to others on this
  // page, same cadence as the main canvas's presence.heartbeat.
  useEffect(() => {
    const send = () => {
      heartbeat({
        clientId,
        pageId,
        username: identityRef.current.username,
        countryCode: identityRef.current.countryCode,
        cursorX: lastCursorWorldRef.current.x,
        cursorY: lastCursorWorldRef.current.y,
      }).catch(() => {});
    };
    send();
    const id = setInterval(send, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [heartbeat, pageId, clientId]);

  // Continuously advance RemoteCursors' glide-to-latest-position animation,
  // independent of paint/resize events — nothing else drives a per-frame
  // loop in this component.
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      remoteCursorsRef.current?.syncPositions(cameraRef.current, viewportRef.current.width, viewportRef.current.height);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const commitChunk = useCallback(
    (
      points: Point[],
      mode: StrokeMode,
      regionId: string,
      chunkBrushType: BrushType | undefined,
      chunkColor: string,
      chunkWidth: number,
      clientStrokeId: string,
    ) => {
      const stroke: SketchbookStroke = {
        clientStrokeId,
        sequence: -1,
        mode,
        regionId,
        brushType: chunkBrushType,
        color: chunkColor,
        width: chunkWidth,
        opacity: 1,
        points,
      };
      renderedIdsRef.current.add(clientStrokeId);
      allStrokesRef.current.push(stroke);
      submitStroke({
        clientStrokeId,
        clientId,
        username,
        countryCode,
        mode,
        pageId,
        regionId,
        brushType: chunkBrushType,
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
    [submitStroke, replayAll, pageId, clientId, username, countryCode],
  );

  const updateBrushCursor = useCallback((screenX: number | null, screenY: number | null) => {
    const el = brushCursorElRef.current;
    if (!el) return;
    if (screenX === null || screenY === null) {
      el.style.display = "none";
      return;
    }
    const diameter = Math.max(4, width * cameraRef.current.zoom);
    el.style.display = "block";
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.width = `${diameter}px`;
    el.style.height = `${diameter}px`;
  }, [width]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      if (panMode) {
        canvas.setPointerCapture(e.pointerId);
        panStartRef.current = { x: screenX, y: screenY };
        return;
      }

      const rawWorldPt = screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height);
      lastCursorWorldRef.current = rawWorldPt;
      const region = findRegionAt(page.regions, rawWorldPt.x, rawWorldPt.y);
      if (!region) return;

      const worldPt = clampToPage(rawWorldPt, page.width, page.height);

      canvas.setPointerCapture(e.pointerId);
      activeRegionRef.current = region;
      lastWorldPointRef.current = worldPt;

      const regionId = region.id;
      const mode = tool;
      const chunkBrushType = mode === "draw" ? brushType : undefined;
      const chunkColor = color;
      const chunkWidth = width;
      bufferRef.current = new StrokeBuffer(
        clientId,
        mode,
        chunkBrushType,
        chunkColor,
        chunkWidth,
        1,
        username,
        countryCode,
        (chunk) => commitChunk(chunk.points, mode, regionId, chunkBrushType, chunkColor, chunkWidth, chunk.clientStrokeId),
      );
      bufferRef.current.addPoint(worldPt);

      const ctx = ctxRef.current;
      const path2d = regionPathsRef.current.get(regionId);
      if (ctx && path2d) {
        ctx.save();
        ctx.clip(path2d);
        if (mode === "erase") {
          drawStroke(ctx, cameraRef.current, viewportRef.current.width, viewportRef.current.height, [worldPt], mode, chunkColor, chunkWidth);
        } else {
          renderBrushStroke(chunkBrushType, {
            ctx,
            camera: cameraRef.current,
            viewportWidth: viewportRef.current.width,
            viewportHeight: viewportRef.current.height,
            points: [worldPt],
            color: chunkColor,
            width: chunkWidth,
            opacity: 1,
          });
        }
        ctx.restore();
      }
    },
    [tool, brushType, color, width, commitChunk, page, clientId, panMode, username, countryCode],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      if (panMode) {
        updateBrushCursor(null, null);
        const start = panStartRef.current;
        if (!start) return;
        applyCamera(panBy(cameraRef.current, screenX - start.x, screenY - start.y));
        panStartRef.current = { x: screenX, y: screenY };
        return;
      }

      updateBrushCursor(screenX, screenY);

      const rawWorldPt = screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height);
      lastCursorWorldRef.current = rawWorldPt;

      const buffer = bufferRef.current;
      const region = activeRegionRef.current;
      const ctx = ctxRef.current;
      if (!buffer || !region || !ctx) return;

      const worldPt = clampToPage(rawWorldPt, page.width, page.height);

      const from = lastWorldPointRef.current ?? worldPt;
      const path2d = regionPathsRef.current.get(region.id);
      if (path2d) {
        ctx.save();
        ctx.clip(path2d);
        if (buffer.mode === "erase") {
          drawSegment(ctx, cameraRef.current, viewportRef.current.width, viewportRef.current.height, from, worldPt, buffer.mode, buffer.color, buffer.width);
        } else {
          renderBrushStroke(buffer.brushType, {
            ctx,
            camera: cameraRef.current,
            viewportWidth: viewportRef.current.width,
            viewportHeight: viewportRef.current.height,
            points: [from, worldPt],
            color: buffer.color,
            width: buffer.width,
            opacity: 1,
          });
        }
        ctx.restore();
      }
      lastWorldPointRef.current = worldPt;
      buffer.addPoint(worldPt);
    },
    [page, updateBrushCursor, panMode, applyCamera],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    bufferRef.current?.finish();
    bufferRef.current = null;
    activeRegionRef.current = null;
    lastWorldPointRef.current = null;
    panStartRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      updateBrushCursor(null, null);
      handlePointerUp(e);
    },
    [handlePointerUp, updateBrushCursor],
  );

  const outlinePaths = useMemo(
    () => page.regions.map((region) => ({ id: region.id, d: regionPathData(region) })),
    [page],
  );

  // World-space-to-screen-space CSS transform matching worldToScreen's own
  // math exactly: viewBox/object-contain only know how to fit an entire box
  // and have no notion of the user's zoom/pan, so the guide layer (outline
  // SVG or free-form image) needs the same explicit camera transform the
  // canvas already applies via Path2D, or it visibly stops tracking zoom/pan
  // while the paint layer keeps moving underneath it.
  const guideTransform = {
    left: viewportSize.width / 2 - cameraSnapshot.x * cameraSnapshot.zoom,
    top: viewportSize.height / 2 - cameraSnapshot.y * cameraSnapshot.zoom,
    scale: cameraSnapshot.zoom,
  };

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
        className={`absolute inset-0 touch-none ${panMode ? "cursor-grab active:cursor-grabbing" : "cursor-none"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
      />
      {page.imageUrl ? (
        // Free-form page: a single full-canvas region (see lib/sketchbookPages.ts)
        // means painting is unrestricted, so there's no meaningful region
        // boundary to draw — the real artwork is the visible guide instead.
        // Explicit pixel width/height (not object-contain) so the element's
        // own local coordinate system is 1:1 with world units before
        // guideTransform scales/positions it — same convention as the SVG
        // branch below.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.imageUrl}
          alt=""
          width={page.width}
          height={page.height}
          className="pointer-events-none absolute top-0 left-0"
          style={{
            transform: `translate(${guideTransform.left}px, ${guideTransform.top}px) scale(${guideTransform.scale})`,
            transformOrigin: "0 0",
          }}
        />
      ) : (
        <svg
          className="pointer-events-none absolute top-0 left-0"
          width={page.width}
          height={page.height}
          viewBox={`0 0 ${page.width} ${page.height}`}
          style={{
            transform: `translate(${guideTransform.left}px, ${guideTransform.top}px) scale(${guideTransform.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {outlinePaths.map((p) => (
            <path key={p.id} d={p.d} fill="none" stroke="#1a1a1a" strokeWidth={3} strokeLinejoin="round" />
          ))}
        </svg>
      )}
      {!panMode && (
        <BrushCursor ref={brushCursorElRef} tool={tool === "erase" ? "eraser" : "brush"} brushType={brushType} color={color} />
      )}
      <RemoteCursors
        ref={remoteCursorsRef}
        entries={presenceList ?? []}
        selfClientId={clientId}
        camera={cameraSnapshot}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
      />
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2.5 rounded-2xl bg-white/90 px-3 py-2.5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-1">
          {activePalette.colors.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`color ${swatch}`}
              onClick={() => {
                setColor(swatch);
                setTool("draw");
                setPanMode(false);
              }}
              className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: swatch, borderColor: color === swatch && tool === "draw" ? "#1a1a1a" : "transparent" }}
            />
          ))}
          <button
            type="button"
            aria-label={`switch color palette (currently ${activePalette.name})`}
            title={`Palette: ${activePalette.name}`}
            onClick={() => {
              const i = PALETTE_PRESETS.findIndex((p) => p.id === activePalette.id);
              setActivePalette(PALETTE_PRESETS[(i + 1) % PALETTE_PRESETS.length]);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-sm"
          >
            🎨
          </button>
        </div>

        <div className="h-6 w-px bg-black/10" />

        <div className="flex items-center gap-2 rounded-full bg-black/[0.04] px-2 py-1">
          <select
            aria-label="brush texture"
            value={brushType}
            onChange={(e) => setBrushType(e.target.value as BrushType)}
            disabled={tool === "erase"}
            className="rounded-full bg-black/10 px-2 py-1 text-xs font-medium text-[#1a1a1a] disabled:opacity-40"
          >
            {BRUSH_CATALOG.map((b) => (
              <option key={b.type} value={b.type}>
                {b.label}
              </option>
            ))}
          </select>
          <input
            type="range"
            aria-label="brush width"
            title={`Brush size: ${width}`}
            min={MIN_BRUSH_WIDTH}
            max={MAX_SKETCHBOOK_WIDTH}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-20"
          />
          <span className="w-5 text-center text-xs tabular-nums text-[#1a1a1a]/50">{width}</span>
          <button
            type="button"
            aria-pressed={tool === "erase"}
            title="Eraser"
            onClick={() => {
              setTool((t) => (t === "erase" ? "draw" : "erase"));
              setPanMode(false);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${tool === "erase" ? "bg-[#1a1a1a] text-white" : "bg-black/10"}`}
          >
            Eraser
          </button>
        </div>

        <div className="h-6 w-px bg-black/10" />

        <div className="flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-1">
          <button
            type="button"
            aria-pressed={panMode}
            title="Drag to move around the page"
            onClick={() => setPanMode((v) => !v)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${panMode ? "bg-[#1a1a1a] text-white" : "bg-black/10"}`}
          >
            ✋ Pan
          </button>
          <button
            type="button"
            aria-label="zoom out"
            onClick={() => zoomButton(0.8)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-sm font-bold"
          >
            −
          </button>
          <button
            type="button"
            aria-label="zoom in"
            onClick={() => zoomButton(1.25)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-sm font-bold"
          >
            +
          </button>
        </div>

        <div className="h-6 w-px bg-black/10" />

        {editingName ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleUsernameChange(nameDraft);
              setEditingName(false);
            }}
          >
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Anonymous"
              maxLength={MAX_USERNAME_LENGTH}
              autoFocus
              onBlur={() => {
                handleUsernameChange(nameDraft);
                setEditingName(false);
              }}
              className="w-28 rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/40 focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            title="Change your display name"
            onClick={() => {
              setNameDraft(username ?? "");
              setEditingName(true);
            }}
            className="max-w-[140px] truncate rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-[#1a1a1a]"
          >
            {getCountryFlagEmoji(countryCode)} {username ?? "Anonymous"}
          </button>
        )}
      </div>
      {errorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-sm text-white">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
