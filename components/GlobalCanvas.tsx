"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WORLD_WIDTH, WORLD_HEIGHT, MAX_COMMENT_LENGTH } from "@/convex/constants";
import {
  type Camera,
  defaultCamera,
  panBy,
  zoomAt,
  clampZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  distance,
} from "@/lib/camera";
import { screenToWorld, worldToScreen, clampToWorld, isWithinWorld } from "@/lib/coordinates";
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
import { getClientId, getUsername, setUsername, getCachedCountryCode, setCachedCountryCode } from "@/lib/identity";
import { countryCodeToFlag } from "@/lib/flags";
import { type ShapeType, buildShapePoints } from "@/lib/shapes";
import { convertTextToPoints, convertTextToStrokePaths, FONT_STYLES, type FontStyle } from "@/lib/textToPoints";
import { floodFillMask } from "@/lib/floodFill";
import { STICKER_CATALOG } from "@/lib/stickers";
import { calculateSymmetricPoints } from "@/lib/symmetry";
import { CommentsOverlay, type CanvasComment } from "./CommentsOverlay";
import { parseCameraFromSearch, cameraToSearchString } from "@/lib/viewportUrl";
import { captureEvent, captureOperationalError } from "@/lib/observability";
import type { LocalStroke, ServerStroke, Point, Tool, BrushType, SymmetryMode, WorldRect } from "@/lib/types";
import { normalizeRect, strokeIntersectsRegion, fitCameraToRegion } from "@/lib/regionFilter";
import { DrawingToolbar } from "./DrawingToolbar";
import { OnlineCount } from "./OnlineCount";
import { ConnectionStatus } from "./ConnectionStatus";
import { RemoteCursors } from "./RemoteCursors";
import { ThemeToggle } from "./ThemeToggle";
import { ChromeRivet } from "./ChromeRivet";
import { HeaderSeam, MobileGroupLabel } from "./HeaderSeam";
import { BrushCursor } from "./BrushCursor";
import { MagnifierLoupe } from "./MagnifierLoupe";
import { RulerOverlay } from "./RulerOverlay";
import { MiniMap, MINI_MAP_SIZE_PX } from "./MiniMap";
import { TimeTravelMenu } from "./ReplayBar";
import { ExploreMenu } from "./ExploreMenu";
import { BookmarkMenu } from "./BookmarkMenu";
import { CommunityGalleryModal } from "./CommunityGalleryModal";
import { ExportModal } from "./ExportModal";
import { LanguagePicker } from "./LanguagePicker";
import { HotkeysModal } from "./HotkeysModal";
import { AdminPanelModal } from "./AdminPanelModal";
import { AdminBroadcastBanner } from "./AdminBroadcastBanner";
import { AdminImageOverlay, type AdminImagePlacement } from "./AdminImageOverlay";
import { ProtectedZonesOverlay } from "./ProtectedZonesOverlay";
import { t, type Locale } from "@/lib/i18n";
import { HelpModal } from "./HelpModal";
import { GridToggle } from "./GridToggle";
import { UsernameControl } from "./UsernameControl";
import { SpatialCompass } from "./SpatialCompass";
import { FpsHud } from "./FpsHud";
import { RateLimitToast } from "./RateLimitToast";
import { rateLimitTracker } from "@/lib/rateLimitTracker";
import { fpsTracker } from "@/lib/fpsTracker";
import { calculateShapeMetrics } from "@/lib/shapeMetrics";
import { buildStencilPoints, type StencilType } from "@/lib/stencils";
import { drawLaserTrails, type LaserTrail } from "@/lib/laser";
import { drawGridOverlay, snapPointToGrid, type GridConfig } from "@/lib/grid";
import { getVisibleTileKeys, getTileKeysForStroke, getTileCoords, getTileId, TILE_SIZE } from "@/lib/tiling";
import { findStrokeNearPoint } from "@/lib/hitTest";

const MIN_CURSOR_DIAMETER_PX = 4;
const MAGNIFIER_SIZE_PX = 160;
const MAGNIFIER_FACTOR = 2.5;
const MAGNIFIER_OFFSET_PX = 24;
const MIN_SHAPE_DRAG = 2;
// Larger than MIN_SHAPE_DRAG on purpose — a region selection is a bigger
// commitment (scopes replay/export) than starting a shape, so a stray click
// shouldn't silently create a near-zero-area region.
const MIN_REGION_DRAG = 20;
const FILL_CHUNK_SIZE = 90;
// Hard ceiling regardless of the fill's true size, so one click can't blow
// past the per-client rate limit (STROKES_PER_CLIENT_WINDOW) on its own.
const MAX_FILL_CHUNKS = 60;
const HOVER_SCREEN_RADIUS_PX = 8;
const REPLAY_PAGE_SIZE = 1000;
const HEATMAP_GRID_SIZE = 32;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("failed to load snapshot image"));
    img.src = src;
  });
}

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
  const regionDragRef = useRef<{ start: Point; current: Point } | null>(null);
  const [replayRegion, setReplayRegion] = useState<WorldRect | null>(null);
  const isStencilDraggingRef = useRef(false);
  const lastStencilWorldRef = useRef<Point | null>(null);
  const laserTrailsRef = useRef<LaserTrail[]>([]);
  const activeLaserTrailIdRef = useRef<string | null>(null);
  const rulerDragRef = useRef<{
    startWorld: Point;
    startScreen: Point;
    currentWorld: Point;
    currentScreen: Point;
  } | null>(null);
  // Snapshot base image: loaded once if a snapshot exists, painted as the
  // base layer under delta strokes on every redraw. snapshotSequenceRef is
  // the earliest sequence actually available locally (0 if no snapshot was
  // used, since then every stroke was replayed individually).
  const snapshotImageRef = useRef<HTMLImageElement | null>(null);
  const snapshotSequenceRef = useRef(0);

  const [clientId] = useState(() => getClientId());
  const [username, setUsernameState] = useState(() => getUsername());
  const [countryCode, setCountryCode] = useState(() => getCachedCountryCode());

  // Resolve once per browser (cached to localStorage) rather than per
  // stroke — an IP-derived country doesn't change mid-session, and this
  // keeps the geo lookup off the hot drawing path entirely.
  useEffect(() => {
    if (countryCode) return;
    let cancelled = false;
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data: { countryCode: string | null }) => {
        if (cancelled || !data.countryCode) return;
        setCachedCountryCode(data.countryCode);
        setCountryCode(data.countryCode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUsernameChange = useCallback((name: string) => {
    setUsername(name);
    setUsernameState(getUsername());
  }, []);

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
  const [minSequence, setMinSequence] = useState(0);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    mode: "none",
    cellSize: 50,
    snapEnabled: false,
  });
  const [fpsHudOpen, setFpsHudOpen] = useState(false);
  const [shapeMetricsLabel, setShapeMetricsLabel] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushType, setBrushType] = useState<BrushType>("brush");
  const [shapeType, setShapeType] = useState<ShapeType>("line");
  const [selectedStencil, setSelectedStencil] = useState<StencilType>("biohazard");
  const [selectedSticker, setSelectedSticker] = useState<string>(STICKER_CATALOG[0].id);
  const [color, setColor] = useState("#17181a");
  const [brushWidth, setBrushWidth] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(() => Math.round(initialCamera.zoom * 100));
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("alwaysdraw_admin_passcode") || "";
    }
    return "";
  });
  const [imagePlacement, setImagePlacement] = useState<AdminImagePlacement | null>(null);
  const [isStampingImage, setIsStampingImage] = useState(false);
  const [textInputPos, setTextInputPos] = useState<{ world: Point; screen: { x: number; y: number } } | null>(null);
  const [textInputText, setTextInputText] = useState("");
  const [textStyle, setTextStyle] = useState<FontStyle>("sans");
  const [textSize, setTextSize] = useState<number>(32);
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>("off");
  const [commentInputPos, setCommentInputPos] = useState<{ world: Point; screen: { x: number; y: number } } | null>(null);
  const [commentText, setCommentText] = useState("");

  const verifyAdminPasscode = useMutation(api.admin.verifyPasscode);
  const rollbackClient = useMutation(api.admin.rollbackClient);
  const deleteProtectedZone = useMutation(api.admin.deleteProtectedZone);

  const handleDeleteProtectedZone = useCallback(async (zoneId: string) => {
    if (!adminPasscode) return;
    await deleteProtectedZone({ passcode: adminPasscode, zoneId: zoneId as Id<"protectedZones"> });
  }, [adminPasscode, deleteProtectedZone]);

  const handleAuthenticateAdmin = useCallback(async (passcode: string): Promise<boolean> => {
    const isValid = await verifyAdminPasscode({ passcode });
    if (isValid) {
      setAdminPasscode(passcode);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("alwaysdraw_admin_passcode", passcode);
      }
      return true;
    }
    return false;
  }, [verifyAdminPasscode]);

  const handleLogoutAdmin = useCallback(() => {
    setAdminPasscode("");
    setAdminOpen(false);
    setImagePlacement(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("alwaysdraw_admin_passcode");
    }
  }, []);

  const handleStartImagePlacement = useCallback((file: File, url: string, aspectRatio: number) => {
    const initialWidth = 400;
    const initialHeight = Math.round(initialWidth / aspectRatio);
    setImagePlacement({
      file,
      url,
      worldX: Math.round(cameraRef.current.x),
      worldY: Math.round(cameraRef.current.y),
      width: initialWidth,
      height: initialHeight,
      aspectRatio,
    });
  }, []);
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("alwaysdraw_locale") as Locale | null;
      if (saved && ["en", "fr", "ar", "ru", "es", "pt", "tr", "ja"].includes(saved)) {
        return saved;
      }
    }
    return "en";
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hoverAttribution, setHoverAttribution] = useState<{
    screenX: number;
    screenY: number;
    username: string | undefined;
    clientId: string;
    countryCode: string | undefined;
  } | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
  }, [locale]);
  const [cameraSnapshot, setCameraSnapshot] = useState<Camera>(() => initialCamera);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const convex = useConvex();
  const submitStroke = useMutation(api.strokes.submit);
  const heartbeat = useMutation(api.presence.heartbeat);
  const createComment = useMutation(api.comments.create);
  const removeComment = useMutation(api.comments.remove);

  const onlineCount = useQuery(api.presence.onlineCount);
  const presenceList = useQuery(api.presence.list);
  const canvasCommentRows = useQuery(api.comments.list, {});
  const comments = useMemo<CanvasComment[]>(
    () =>
      (canvasCommentRows ?? []).map((c) => ({
        id: c._id,
        author: c.username ?? c.clientId,
        countryCode: c.countryCode,
        text: c.text,
        color: "#e0b13a",
        worldPt: { x: c.x, y: c.y },
        createdAt: c.createdAt,
      })),
    [canvasCommentRows],
  );
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
    drawGridOverlay(ctx, cameraRef.current, width, height, gridConfig, WORLD_WIDTH, WORLD_HEIGHT);
  }, [gridConfig]);

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

  const [visibleTileCount, setVisibleTileCount] = useState<number>(0);

  const redrawStrokes = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { width, height } = viewportRef.current;
    clearCanvas(ctx, width, height);

    // Snapshot base layer, if one was loaded — drawn under delta strokes so
    // later erases (destination-out) still punch through it correctly, same
    // as they punch through individually-replayed strokes.
    if (snapshotImageRef.current) {
      const topLeft = worldToScreen(0, 0, cameraRef.current, width, height);
      const bottomRight = worldToScreen(WORLD_WIDTH, WORLD_HEIGHT, cameraRef.current, width, height);
      ctx.drawImage(
        snapshotImageRef.current,
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y,
      );
    }

    const maxSeqFilter = isReplayMode ? replaySequenceIndex : Infinity;

    // Spatial Tile Partitioning & Viewport-Bounded Culling
    const visibleTileKeys = getVisibleTileKeys(
      cameraRef.current,
      width,
      height,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      TILE_SIZE,
      1,
    );
    const visibleTileSet = new Set(visibleTileKeys);
    if (visibleTileKeys.length !== visibleTileCount) {
      setVisibleTileCount(visibleTileKeys.length);
    }

    for (const s of committedRef.current) {
      if (s.sequence <= maxSeqFilter) {
        if (s.tiles && s.tiles.length > 0) {
          if (!s.tiles.some((t) => visibleTileSet.has(t))) {
            continue; // Culled off-screen stroke for 60 FPS performance
          }
        }
        if (isReplayMode && replayRegion && !strokeIntersectsRegion(s.points, replayRegion)) {
          continue;
        }
        paintOneStroke(ctx, width, height, s);
      }
    }
    if (!isReplayMode) {
      for (const s of pendingRef.current.values()) paintOneStroke(ctx, width, height, s);
      if (shapePreviewRef.current) paintOneStroke(ctx, width, height, shapePreviewRef.current);
      if (laserTrailsRef.current.length > 0) {
        drawLaserTrails(ctx, cameraRef.current, width, height, laserTrailsRef.current);
      }
      if (tool === "stencil" && lastCursorWorldRef.current) {
        const stencilSize = Math.max(40, brushWidth * 6);
        const subPaths = buildStencilPoints(selectedStencil, lastCursorWorldRef.current.x, lastCursorWorldRef.current.y, stencilSize);
        ctx.save();
        ctx.strokeStyle = color || "#ffcc00";
        ctx.lineWidth = Math.max(2, Math.round(brushWidth / 3)) * cameraRef.current.zoom;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.8;
        for (const pts of subPaths) {
          if (pts.length < 2) continue;
          const first = worldToScreen(pts[0].x, pts[0].y, cameraRef.current, width, height);
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < pts.length; i++) {
            const p = worldToScreen(pts[i].x, pts[i].y, cameraRef.current, width, height);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    const liveRegionDrag = regionDragRef.current;
    const regionToDraw = liveRegionDrag
      ? normalizeRect(liveRegionDrag.start, liveRegionDrag.current)
      : replayRegion;
    if (regionToDraw) {
      const topLeft = worldToScreen(regionToDraw.minX, regionToDraw.minY, cameraRef.current, width, height);
      const bottomRight = worldToScreen(regionToDraw.maxX, regionToDraw.maxY, cameraRef.current, width, height);
      ctx.save();
      ctx.strokeStyle = "#e0b13a";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.restore();
    }
  }, [paintOneStroke, isReplayMode, replaySequenceIndex, visibleTileCount, tool, selectedStencil, brushWidth, color, replayRegion]);

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
    const isBrushOrLaserTool = tool === "brush" || tool === "eraser" || tool === "laser";

    if (!isBrushOrLaserTool || !pos) {
      if (el) el.style.display = "none";
      if (canvas) canvas.style.cursor = "";
      return;
    }

    const { width, height } = viewportRef.current;
    const worldPt = screenToWorld(pos.x, pos.y, cameraRef.current, width, height);
    const onWall = isWithinWorld(worldPt);
    if (canvas) canvas.style.cursor = onWall ? "none" : "default";

    if (!el) return;
    if (!onWall) {
      el.style.display = "none";
      return;
    }
    const diameter = tool === "laser" ? 14 : Math.max(MIN_CURSOR_DIAMETER_PX, brushWidth * cameraRef.current.zoom);
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
    const startNode = el.querySelector<SVGCircleElement>("[data-ruler-start-node]");
    const endNode = el.querySelector<SVGCircleElement>("[data-ruler-end-node]");
    const card = el.querySelector<HTMLDivElement>("[data-ruler-card]");
    if (!line || !card) return;

    line.setAttribute("x1", String(drag.startScreen.x));
    line.setAttribute("y1", String(drag.startScreen.y));
    line.setAttribute("x2", String(drag.currentScreen.x));
    line.setAttribute("y2", String(drag.currentScreen.y));

    if (startNode) {
      startNode.setAttribute("cx", String(drag.startScreen.x));
      startNode.setAttribute("cy", String(drag.startScreen.y));
    }
    if (endNode) {
      endNode.setAttribute("cx", String(drag.currentScreen.x));
      endNode.setAttribute("cy", String(drag.currentScreen.y));
    }

    const distPx = Math.round(distance(drag.startScreen, drag.currentScreen));
    const distMeters = (distance(drag.startWorld, drag.currentWorld) / 38).toFixed(1);
    const dx = Math.round(drag.currentScreen.x - drag.startScreen.x);
    const dy = Math.round(drag.currentScreen.y - drag.startScreen.y);
    let angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-chrome-border/60 pb-1 font-bold text-accent-yellow">
        <span>📏 ${distPx} px</span>
        <span class="text-ink-dim">${distMeters} m</span>
      </div>
      <div class="flex items-center justify-between text-[10px] text-ink-dim">
        <span>Inclination Angle:</span>
        <span class="font-bold text-ink">${angleDeg}°</span>
      </div>
      <div class="flex items-center justify-between text-[10px] text-ink-dim">
        <span>Offset Vector:</span>
        <span class="font-bold text-ink">Δx:${dx > 0 ? `+${dx}` : dx} Δy:${dy > 0 ? `+${dy}` : dy}</span>
      </div>
    `;

    card.style.left = `${(drag.startScreen.x + drag.currentScreen.x) / 2}px`;
    card.style.top = `${(drag.startScreen.y + drag.currentScreen.y) / 2}px`;
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
        fpsTracker.tick(visibleTileCount, 10000, committedRef.current.length);
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
    [redrawWorld, redrawStrokes, redrawHeatmap, updateCursorOverlay, updateMagnifier, updateMiniMapViewportRect, visibleTileCount],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (laserTrailsRef.current.length === 0) return;
      const now = Date.now();
      let hasPoints = false;
      for (const trail of laserTrailsRef.current) {
        trail.points = trail.points.filter((p) => now - p.timestamp < 1500);
        if (trail.points.length > 0) hasPoints = true;
      }
      laserTrailsRef.current = laserTrailsRef.current.filter((t) => t.points.length > 0);
      if (hasPoints || laserTrailsRef.current.length > 0) {
        scheduleRedraw({ strokes: true });
      }
    }, 40);
    return () => clearInterval(interval);
  }, [scheduleRedraw]);

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
        // Step 1: Check for latest snapshot to seed initial sequence. Only
        // skip replaying strokes up to the snapshot if its image actually
        // loads — otherwise we'd silently render a wall missing everything
        // before that point, with no error. Falls back to full replay.
        const latestSnapshot = await convex.query(api.snapshots.getLatest);
        if (latestSnapshot && latestSnapshot.sequence > 0) {
          try {
            snapshotImageRef.current = await loadImage(latestSnapshot.imageData);
            snapshotSequenceRef.current = latestSnapshot.sequence;
            setMinSequence(latestSnapshot.sequence);
            after = latestSnapshot.sequence;
          } catch (imageError) {
            captureOperationalError(imageError, "snapshot_image_load", {
              sequence: latestSnapshot.sequence,
            });
          }
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
            snapshot_used: snapshotImageRef.current !== null,
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
    if (!presenceList) return;
    const now = Date.now();
    for (const p of presenceList) {
      if (p.clientId === clientId) continue;
      if (p.laserTrail && p.laserTrail.length > 0) {
        const validPoints = p.laserTrail.filter((pt) => now - pt.timestamp < 1500);
        if (validPoints.length > 0) {
          const existing = laserTrailsRef.current.find((t) => t.id === `remote-${p.clientId}`);
          if (existing) {
            existing.points = validPoints;
          } else {
            laserTrailsRef.current.push({
              id: `remote-${p.clientId}`,
              color: "#39c07a",
              points: validPoints,
            });
          }
        }
      }
    }
    scheduleRedraw({ strokes: true });
  }, [presenceList, clientId, scheduleRedraw]);

  useEffect(() => {
    const send = () => {
      const myTrail = laserTrailsRef.current.find((t) => !t.id.startsWith("remote-"));
      heartbeat({
        clientId,
        cursorX: lastCursorWorldRef.current.x,
        cursorY: lastCursorWorldRef.current.y,
        laserTrail: myTrail ? myTrail.points : undefined,
      }).catch(() => {});
    };
    send();
    const id = setInterval(send, 3000);
    return () => clearInterval(id);
  }, [heartbeat, clientId]);

  const commitOwnChunk = useCallback(
    (chunk: LocalStroke) => {
      if (!firstMarkTrackedRef.current) {
        firstMarkTrackedRef.current = true;
        captureEvent("first_mark", { mode: chunk.mode, brush: chunk.brushType });
      }
      rateLimitTracker.recordSubmission();
      pendingRef.current.set(chunk.clientStrokeId, chunk);
      submitStroke(chunk).catch((err) => {
        console.error("stroke submit rejected", err);
        const isRateLimited = err instanceof ConvexError;
        if (isRateLimited) {
          rateLimitTracker.recordRateLimitError();
        }
        captureOperationalError(err, "stroke_submit", { mode: chunk.mode });
        pendingRef.current.delete(chunk.clientStrokeId);
        setSubmitError(
          isRateLimited ? "drawing too fast — pace yourself a sec" : "a mark didn't stick — try again",
        );
        scheduleRedraw({ strokes: true });
      });
    },
    [scheduleRedraw, submitStroke],
  );

  const handleConfirmStampImage = useCallback(async () => {
    if (!imagePlacement) return;
    setIsStampingImage(true);

    try {
      const img = new Image();
      img.src = imagePlacement.url;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const canvas = document.createElement("canvas");
      const maxDim = 70;
      let targetW = img.width;
      let targetH = img.height;

      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH / targetW) * maxDim);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW / targetH) * maxDim);
          targetH = maxDim;
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH).data;

      const pixelSize = imagePlacement.width / targetW;
      const halfW = imagePlacement.width / 2;
      const halfH = (imagePlacement.width * (targetH / targetW)) / 2;

      const pointsByColor = new Map<string, { points: Point[]; opacity: number }>();

      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const idx = (y * targetW + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const a = imgData[idx + 3] / 255;

          if (a < 0.1) continue;

          const qR = Math.round(r / 8) * 8;
          const qG = Math.round(g / 8) * 8;
          const qB = Math.round(b / 8) * 8;
          const colorHex = `#${((1 << 24) + (Math.min(255, qR) << 16) + (Math.min(255, qG) << 8) + Math.min(255, qB)).toString(16).slice(1)}`;
          const rawPx = Math.round(imagePlacement.worldX - halfW + x * pixelSize + pixelSize / 2);
          const rawPy = Math.round(imagePlacement.worldY - halfH + y * pixelSize + pixelSize / 2);

          // Skip pixels that fall outside the valid [0, WORLD_WIDTH] x [0, WORLD_HEIGHT] world bounds
          if (rawPx < 0 || rawPx > WORLD_WIDTH || rawPy < 0 || rawPy > WORLD_HEIGHT) {
            continue;
          }

          const px = rawPx;
          const py = rawPy;

          const existing = pointsByColor.get(colorHex);
          if (existing) {
            existing.points.push({ x: px, y: py });
          } else {
            pointsByColor.set(colorHex, {
              points: [{ x: px, y: py }],
              opacity: Math.max(0.1, Math.min(1, Math.round(a * 100) / 100)),
            });
          }
        }
      }

      const batchTasks: Promise<unknown>[] = [];
      let totalPixels = 0;

      for (const [color, { points, opacity }] of pointsByColor.entries()) {
        totalPixels += points.length;
        for (let i = 0; i < points.length; i += 90) {
          const chunk = points.slice(i, i + 90);
          const clientStrokeId = `admin-img-${Date.now()}-${totalPixels}-${i}-${Math.random().toString(36).slice(2, 6)}`;
          batchTasks.push(
            submitStroke({
              clientStrokeId,
              clientId: "ADMIN_IMAGE_STAMPER",
              mode: "draw",
              brushType: "pixel",
              color,
              width: Math.max(3, Math.round(pixelSize)),
              opacity,
              points: chunk,
              clientTimestamp: Date.now(),
            }),
          );
        }
      }

      await Promise.all(batchTasks);
      setImagePlacement(null);
      scheduleRedraw({ world: true, strokes: true });
    } catch (err) {
      console.error("image stamp failed", err);
      captureOperationalError(err, "admin_image_stamp");
      setSubmitError("image stamp failed partway — try a smaller or simpler image");
      scheduleRedraw({ world: true, strokes: true });
    } finally {
      setIsStampingImage(false);
    }
  }, [imagePlacement, submitStroke, scheduleRedraw]);

  const handlePurgeAllStampedImages = useCallback(async () => {
    await rollbackClient({
      passcode: adminPasscode,
      targetClientId: "ADMIN_IMAGE_STAMPER",
    });
    setImagePlacement(null);
    scheduleRedraw({ world: true, strokes: true });
  }, [rollbackClient, adminPasscode, scheduleRedraw]);

  const handleCommitText = useCallback(() => {
    if (!textInputPos || !textInputText.trim()) {
      setTextInputPos(null);
      setTextInputText("");
      return;
    }

    const strokePaths = convertTextToStrokePaths(textInputText, textInputPos.world, textSize, textStyle);
    for (const pts of strokePaths) {
      if (pts.length >= 2) {
        const buffer = new StrokeBuffer(
          clientId,
          "draw",
          "brush",
          color,
          Math.max(2, Math.round(textSize / 12)),
          opacity,
          username,
          countryCode,
          commitOwnChunk,
        );
        for (const p of pts) buffer.addPoint(p);
        buffer.finish();
      }
    }
    scheduleRedraw({ strokes: true });
    setTextInputPos(null);
    setTextInputText("");
  }, [textInputPos, textInputText, textSize, textStyle, clientId, color, opacity, username, countryCode, commitOwnChunk, scheduleRedraw]);

  useEffect(() => {
    if (!submitError) return;
    const id = setTimeout(() => setSubmitError(null), 4000);
    return () => clearTimeout(id);
  }, [submitError]);

  // One StrokeBuffer per symmetry copy (1 for "off", up to 8 for mandala8) —
  // each mirrored copy is its own independent connected line, not extra
  // points tacked onto a single buffer, which would draw spurious lines
  // jumping between the mirrored positions instead of parallel strokes.
  const drawBuffersRef = useRef<StrokeBuffer[] | null>(null);
  const lastDrawWorldsRef = useRef<Point[] | null>(null);
  const symmetryCenterRef = useRef<Point>({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });

  const beginDraw = useCallback(
    (worldPoint: Point) => {
      // Locked in for the whole stroke, not recomputed per point — mirrors
      // stay parallel even if the camera pans mid-stroke.
      symmetryCenterRef.current = { x: cameraRef.current.x, y: cameraRef.current.y };
      const mode = tool === "eraser" ? "off" : symmetryMode;
      const points = calculateSymmetricPoints(worldPoint, mode, symmetryCenterRef.current);

      drawBuffersRef.current = points.map(
        () =>
          new StrokeBuffer(
            clientId,
            tool === "eraser" ? "erase" : "draw",
            tool === "eraser" ? undefined : brushType,
            color,
            brushWidth,
            opacity,
            username,
            countryCode,
            commitOwnChunk,
          ),
      );
      drawBuffersRef.current.forEach((buffer, i) => buffer.addPoint(points[i]));
      lastDrawWorldsRef.current = points;
    },
    [commitOwnChunk, clientId, tool, brushType, color, brushWidth, opacity, username, countryCode, symmetryMode],
  );

  const continueDraw = useCallback((worldPoint: Point) => {
    const buffers = drawBuffersRef.current;
    const lastPoints = lastDrawWorldsRef.current;
    if (!buffers || !lastPoints) return;

    const mode = buffers[0].mode === "erase" ? "off" : symmetryMode;
    const points = calculateSymmetricPoints(worldPoint, mode, symmetryCenterRef.current);
    if (points.length !== buffers.length) return; // symmetry mode changed mid-stroke; ignore rather than mismatch arrays

    const ctx = ctxRef.current;
    const { width, height } = viewportRef.current;
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      const prev = lastPoints[i];
      if (ctx) {
        if (buffer.mode === "erase") {
          drawStroke(ctx, cameraRef.current, width, height, [prev, points[i]], "erase", buffer.color, buffer.width);
        } else {
          renderBrushStroke(buffer.brushType, {
            ctx,
            camera: cameraRef.current,
            viewportWidth: width,
            viewportHeight: height,
            points: [prev, points[i]],
            color: buffer.color,
            width: buffer.width,
            opacity: buffer.opacity,
          });
        }
      }
      buffer.addPoint(points[i]);
    }
    lastDrawWorldsRef.current = points;
  }, [symmetryMode]);

  const endDraw = useCallback(() => {
    drawBuffersRef.current?.forEach((buffer) => buffer.finish());
    drawBuffersRef.current = null;
    lastDrawWorldsRef.current = null;
  }, []);

  const activePointersRef = useRef<Map<number, Point>>(new Map());
  const isPanningRef = useRef(false);
  const isSpaceDownRef = useRef(false);
  const lastPanScreenRef = useRef<Point | null>(null);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

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

  const [hotkeysOpen, setHotkeysOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceDownRef.current = true;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "b" || key === "1") {
        setTool("brush");
      } else if (key === "e" || key === "2") {
        setTool("eraser");
      } else if (key === "h" || key === "3") {
        setTool("pan");
      } else if (key === "m" || key === "4") {
        setTool("magnifier");
      } else if (key === "s" || key === "5") {
        setTool("shape");
      } else if (key === "t" || key === "6") {
        setTool("stencil");
      } else if (key === "r" || key === "7") {
        setTool("ruler");
      } else if (key === "l") {
        setTool("laser");
      } else if (key === "i" || key === "8") {
        setTool("eyedropper");
      } else if (key === "g") {
        setGridConfig((prev) => ({
          ...prev,
          mode: prev.mode === "none" ? "square" : prev.mode === "square" ? "isometric" : "none",
        }));
      } else if (key === "p") {
        setFpsHudOpen((v) => !v);
      } else if (key === "f") {
        setShowHeatmap((v) => !v);
      } else if (key === "+" || key === "=") {
        zoomButton(1.25);
      } else if (key === "-" || key === "_") {
        zoomButton(0.8);
      } else if (key === "0" || key === "z") {
        if (!e.metaKey && !e.ctrlKey) resetView();
      } else if (key === "?" || key === "k") {
        setHotkeysOpen((prev) => !prev);
      } else if (e.shiftKey && (key === "A" || key === "a")) {
        setAdminOpen((prev) => !prev);
      }
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
  }, [resetView, zoomButton]);

  const getScreenPoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const getPointerWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const screen = getScreenPoint(clientX, clientY);
      const { width, height } = viewportRef.current;
      const pt = clampToWorld(screenToWorld(screen.x, screen.y, cameraRef.current, width, height));
      return snapPointToGrid(pt, gridConfig);
    },
    [getScreenPoint, gridConfig],
  );

  const handleFloodFillAt = useCallback(
    (worldPt: Point) => {
      const worldCanvas = worldCanvasRef.current;
      const strokesCanvas = canvasRef.current;
      if (!worldCanvas || !strokesCanvas) return;
      const { width, height } = viewportRef.current;
      if (width === 0 || height === 0) return;

      // Flood fill has to see what's actually on screen — background +
      // committed strokes composited — not just the vector stroke data,
      // since the boundary it respects is whatever's visibly drawn.
      const composite = document.createElement("canvas");
      composite.width = width;
      composite.height = height;
      const compositeCtx = composite.getContext("2d", { willReadFrequently: true });
      if (!compositeCtx) return;
      compositeCtx.drawImage(worldCanvas, 0, 0);
      compositeCtx.drawImage(strokesCanvas, 0, 0);
      const imageData = compositeCtx.getImageData(0, 0, width, height);

      const screenSeed = worldToScreen(worldPt.x, worldPt.y, cameraRef.current, width, height);
      const filledScreenPoints = floodFillMask(imageData, screenSeed.x, screenSeed.y, {
        step: Math.max(2, Math.round(3 / cameraRef.current.zoom)),
      });
      if (filledScreenPoints.length === 0) return;

      const worldPoints = filledScreenPoints.map((p) =>
        clampToWorld(screenToWorld(p.x, p.y, cameraRef.current, width, height)),
      );
      const dabWidth = Math.max(3, Math.round((3 / cameraRef.current.zoom) * 1.6));

      for (let i = 0; i < worldPoints.length && i < FILL_CHUNK_SIZE * MAX_FILL_CHUNKS; i += FILL_CHUNK_SIZE) {
        const chunkPoints = worldPoints.slice(i, i + FILL_CHUNK_SIZE);
        const tiles = getTileKeysForStroke(chunkPoints, dabWidth, WORLD_WIDTH, WORLD_HEIGHT);
        const clientStrokeId = `${clientId}-fill-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
        const stroke: LocalStroke = {
          clientStrokeId,
          clientId,
          username,
          countryCode,
          mode: "draw",
          brushType: "pixel",
          color,
          width: dabWidth,
          opacity,
          points: chunkPoints,
          tiles,
          clientTimestamp: Date.now(),
        };
        pendingRef.current.set(stroke.clientStrokeId, stroke);

        submitStroke({
          clientStrokeId: stroke.clientStrokeId,
          clientId,
          username: stroke.username,
          countryCode: stroke.countryCode,
          mode: stroke.mode,
          brushType: stroke.brushType,
          color: stroke.color,
          width: stroke.width,
          opacity: stroke.opacity,
          points: stroke.points,
          clientTimestamp: stroke.clientTimestamp,
        }).catch(() => {
          pendingRef.current.delete(stroke.clientStrokeId);
          scheduleRedraw({ world: true, strokes: true });
        });
      }
      scheduleRedraw({ world: true, strokes: true });
    },
    [color, opacity, clientId, username, countryCode, submitStroke, scheduleRedraw],
  );

  const handleStampStickerAt = useCallback(
    (worldPt: Point) => {
      const sticker = STICKER_CATALOG.find((s) => s.id === selectedSticker) ?? STICKER_CATALOG[0];

      // Rasterize the emoji glyph once at a fixed resolution, then stamp its
      // pixels as world-space dabs — the same technique admin image upload
      // already uses, which is what lets a full-color glyph (not just a
      // single-color vector shape) persist and render identically for
      // everyone, not just the client that placed it.
      const RES = 64;
      const offscreen = document.createElement("canvas");
      offscreen.width = RES;
      offscreen.height = RES;
      const octx = offscreen.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.clearRect(0, 0, RES, RES);
      octx.font = `${Math.round(RES * 0.75)}px sans-serif`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(sticker.emoji, RES / 2, RES / 2 + RES * 0.05);
      const imageData = octx.getImageData(0, 0, RES, RES);

      const stickerWorldSize = Math.max(60, brushWidth * 8);
      const worldPerPixel = stickerWorldSize / RES;

      const pointsByColor = new Map<string, Point[]>();
      for (let y = 0; y < RES; y++) {
        for (let x = 0; x < RES; x++) {
          const idx = (y * RES + x) * 4;
          const a = imageData.data[idx + 3];
          if (a < 40) continue;
          const r = imageData.data[idx];
          const g = imageData.data[idx + 1];
          const b = imageData.data[idx + 2];
          const qR = Math.round(r / 8) * 8;
          const qG = Math.round(g / 8) * 8;
          const qB = Math.round(b / 8) * 8;
          const colorHex = `#${((1 << 24) + (qR << 16) + (qG << 8) + qB).toString(16).slice(1)}`;
          const px = worldPt.x + (x - RES / 2) * worldPerPixel;
          const py = worldPt.y + (y - RES / 2) * worldPerPixel;
          if (px < 0 || px > WORLD_WIDTH || py < 0 || py > WORLD_HEIGHT) continue;
          const existing = pointsByColor.get(colorHex);
          if (existing) existing.push({ x: Math.round(px), y: Math.round(py) });
          else pointsByColor.set(colorHex, [{ x: Math.round(px), y: Math.round(py) }]);
        }
      }

      const dabWidth = Math.max(2, Math.round(worldPerPixel * 1.4));
      let chunkIndex = 0;
      for (const [dabColor, dabPoints] of pointsByColor.entries()) {
        for (let i = 0; i < dabPoints.length; i += FILL_CHUNK_SIZE) {
          if (chunkIndex >= MAX_FILL_CHUNKS) break;
          const chunkPoints = dabPoints.slice(i, i + FILL_CHUNK_SIZE);
          const tiles = getTileKeysForStroke(chunkPoints, dabWidth, WORLD_WIDTH, WORLD_HEIGHT);
          const clientStrokeId = `${clientId}-sticker-${Date.now()}-${chunkIndex}-${Math.random().toString(36).slice(2, 7)}`;
          const stroke: LocalStroke = {
            clientStrokeId,
            clientId,
            username,
            countryCode,
            mode: "draw",
            brushType: "pixel",
            color: dabColor,
            width: dabWidth,
            opacity,
            points: chunkPoints,
            tiles,
            clientTimestamp: Date.now(),
          };
          pendingRef.current.set(stroke.clientStrokeId, stroke);

          submitStroke({
            clientStrokeId: stroke.clientStrokeId,
            clientId,
            username: stroke.username,
            countryCode: stroke.countryCode,
            mode: stroke.mode,
            brushType: stroke.brushType,
            color: stroke.color,
            width: stroke.width,
            opacity: stroke.opacity,
            points: stroke.points,
            clientTimestamp: stroke.clientTimestamp,
          }).catch(() => {
            pendingRef.current.delete(stroke.clientStrokeId);
            scheduleRedraw({ world: true, strokes: true });
          });
          chunkIndex++;
        }
      }
      scheduleRedraw({ world: true, strokes: true });
    },
    [selectedSticker, brushWidth, opacity, clientId, username, countryCode, submitStroke, scheduleRedraw],
  );

  const handleSubmitComment = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = commentText.trim();
      if (!text || !commentInputPos) return;
      createComment({
        clientId,
        username,
        countryCode,
        text,
        x: Math.round(commentInputPos.world.x),
        y: Math.round(commentInputPos.world.y),
      }).catch(() => {});
      setCommentText("");
      setCommentInputPos(null);
    },
    [commentText, commentInputPos, clientId, username, countryCode, createComment],
  );

  const handleDeleteComment = useCallback(
    (id: string) => {
      removeComment({ commentId: id as Id<"canvasComments">, clientId }).catch(() => {});
    },
    [clientId, removeComment],
  );

  const stampStencilAt = useCallback(
    (worldPt: Point) => {
      const stencilSize = Math.max(40, brushWidth * 6);
      const subPaths = buildStencilPoints(selectedStencil, worldPt.x, worldPt.y, stencilSize);
      for (const points of subPaths) {
        const tiles = getTileKeysForStroke(points, brushWidth, WORLD_WIDTH, WORLD_HEIGHT);
        const clientStrokeId = `${clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const stroke: LocalStroke = {
          clientStrokeId,
          clientId,
          username,
          countryCode,
          mode: "draw",
          brushType: "chalk",
          color,
          width: Math.max(3, Math.round(brushWidth / 2)),
          opacity,
          points,
          tiles,
          clientTimestamp: Date.now(),
        };
        pendingRef.current.set(stroke.clientStrokeId, stroke);

        submitStroke({
          clientStrokeId: stroke.clientStrokeId,
          clientId,
          username: stroke.username,
          countryCode: stroke.countryCode,
          mode: stroke.mode,
          brushType: stroke.brushType,
          color: stroke.color,
          width: stroke.width,
          opacity: stroke.opacity,
          points: stroke.points,
          clientTimestamp: stroke.clientTimestamp,
        }).catch(() => {
          pendingRef.current.delete(stroke.clientStrokeId);
          scheduleRedraw({ world: true, strokes: true });
        });
      }
      scheduleRedraw({ world: true, strokes: true });
    },
    [brushWidth, selectedStencil, color, opacity, clientId, username, countryCode, submitStroke, scheduleRedraw],
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

      // Time Travel is meant to be read-only: allow inspection tools
      // (pan/magnifier/ruler/region) but block anything that commits a mark.
      // An allowlist, not a denylist, so a newly added drawing tool is
      // blocked by default rather than silently slipping through. Region
      // selection commits nothing to the canvas either, and opening Time
      // Travel itself enters replay mode before "Select Region" is ever
      // clicked — without this, the drag silently no-ops.
      if (isReplayMode && tool !== "pan" && tool !== "magnifier" && tool !== "ruler" && tool !== "region") return;

      if (tool === "pan") {
        isPanningRef.current = true;
        lastPanScreenRef.current = screenPt;
        return;
      }

      if (tool === "magnifier") return;

      if (tool === "eyedropper") {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const screenX = Math.round(e.clientX - rect.left);
          const screenY = Math.round(e.clientY - rect.top);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const pixel = ctx.getImageData(screenX, screenY, 1, 1).data;
            if (pixel[3] > 0) {
              const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
              setColor(hex);
              setSubmitError(`SAMPLED COLOR: ${hex.toUpperCase()}`);
            }
          }
        }
        setTool("brush");
        return;
      }

      const worldPt = getPointerWorld(e.clientX, e.clientY);
      Object.assign(lastCursorWorldRef.current, worldPt);

      if (tool === "text") {
        const screenPt = getScreenPoint(e.clientX, e.clientY);
        setTextInputPos({ world: worldPt, screen: screenPt });
        return;
      }

      if (tool === "fill") {
        handleFloodFillAt(worldPt);
        return;
      }

      if (tool === "sticker") {
        handleStampStickerAt(worldPt);
        return;
      }

      if (tool === "comment") {
        const screenPt = getScreenPoint(e.clientX, e.clientY);
        setCommentInputPos({ world: worldPt, screen: screenPt });
        return;
      }

      if (tool === "shape") {
        shapeDragRef.current = { start: worldPt, current: worldPt };
        return;
      }

      if (tool === "region") {
        regionDragRef.current = { start: worldPt, current: worldPt };
        return;
      }

      if (tool === "stencil") {
        isStencilDraggingRef.current = true;
        lastStencilWorldRef.current = worldPt;
        stampStencilAt(worldPt);
        return;
      }

      if (tool === "laser") {
        const trailId = `laser-${Date.now()}`;
        activeLaserTrailIdRef.current = trailId;
        laserTrailsRef.current.push({
          id: trailId,
          color: color || "#39c07a",
          points: [{ ...worldPt, timestamp: Date.now() }],
        });
        scheduleRedraw({ strokes: true });
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
    [
      beginDraw,
      color,
      endDraw,
      getPointerWorld,
      getScreenPoint,
      handleFloodFillAt,
      handleStampStickerAt,
      isReplayMode,
      scheduleRedraw,
      stampStencilAt,
      tool,
      updateRuler,
    ],
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
      Object.assign(lastCursorWorldRef.current, worldPt);

      // Attribution tooltip: only while genuinely hovering (mouse, no button
      // held) — a stencil/shape/ruler drag or an active brush stroke has its
      // own meaning for pointer movement and shouldn't also flip a tooltip
      // in and out under the cursor. Pre-filtered to strokes tagged with the
      // cursor's own spatial tile (already stored per stroke for rendering)
      // so this stays cheap regardless of how many strokes the wall has.
      if (e.pointerType === "mouse" && e.buttons === 0) {
        const { tileX, tileY } = getTileCoords(worldPt.x, worldPt.y, TILE_SIZE);
        const cursorTileId = getTileId(tileX, tileY);
        const candidates = committedRef.current.filter((s) => s.tiles?.includes(cursorTileId));
        const extraRadiusWorld = HOVER_SCREEN_RADIUS_PX / cameraRef.current.zoom;
        const hit = findStrokeNearPoint(candidates, worldPt, extraRadiusWorld);
        setHoverAttribution(
          hit
            ? {
                screenX: screenPt.x,
                screenY: screenPt.y,
                username: hit.username,
                clientId: hit.clientId,
                countryCode: hit.countryCode,
              }
            : null,
        );
      } else {
        setHoverAttribution(null);
      }

      if (tool === "laser") {
        if (activeLaserTrailIdRef.current) {
          const trail = laserTrailsRef.current.find((t) => t.id === activeLaserTrailIdRef.current);
          if (trail) {
            trail.points.push({ ...worldPt, timestamp: Date.now() });
            scheduleRedraw({ strokes: true });
          }
        }
        return;
      }

      if (tool === "shape") {
        const drag = shapeDragRef.current;
        if (!drag) return;
        drag.current = worldPt;
        const metrics = calculateShapeMetrics(shapeType, drag.start, drag.current);
        setShapeMetricsLabel(metrics.label);
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

      if (tool === "region") {
        const drag = regionDragRef.current;
        if (!drag) return;
        drag.current = worldPt;
        scheduleRedraw({ strokes: true });
        return;
      }

      if (tool === "stencil") {
        if (isStencilDraggingRef.current && lastStencilWorldRef.current) {
          const minSpacing = Math.max(30, brushWidth * 3);
          if (distance(lastStencilWorldRef.current, worldPt) >= minSpacing) {
            lastStencilWorldRef.current = worldPt;
            stampStencilAt(worldPt);
          }
        }
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
    [continueDraw, getPointerWorld, getScreenPoint, scheduleRedraw, tool, shapeType, color, brushWidth, opacity, clientId, updateCursorOverlay, updateMagnifier, updateRuler, stampStencilAt],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointersRef.current.delete(e.pointerId);

      if (tool === "laser") {
        activeLaserTrailIdRef.current = null;
      }

      if (tool === "stencil") {
        isStencilDraggingRef.current = false;
        lastStencilWorldRef.current = null;
        return;
      }

      if (tool === "shape") {
        setShapeMetricsLabel(null);
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
              username,
              countryCode,
              commitOwnChunk,
            );
            for (const p of pts) buffer.addPoint(p);
            buffer.finish();
          }
        }
        scheduleRedraw({ strokes: true });
      }

      if (tool === "region") {
        const drag = regionDragRef.current;
        regionDragRef.current = null;
        if (drag && distance(drag.start, drag.current) >= MIN_REGION_DRAG) {
          setReplayRegion(normalizeRect(drag.start, drag.current));
        }
        setTool("brush");
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
    [endDraw, tool, shapeType, color, brushWidth, opacity, clientId, username, countryCode, commitOwnChunk, scheduleRedraw, updateRuler],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      hideCursorOverlay();
      setHoverAttribution(null);
      handlePointerUp(e);
    },
    [handlePointerUp, hideCursorOverlay],
  );



  const handleShare = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?${cameraToSearchString(cameraRef.current)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    captureEvent("view_shared");
  }, []);

  const handleEnterReplay = useCallback(() => {
    setIsReplayMode(true);
    setReplaySequenceIndex(snapshotSequenceRef.current);
    setIsPlayingReplay(true);
    if (replayRegion) {
      const fitted = fitCameraToRegion(replayRegion, viewportRef.current.width, viewportRef.current.height);
      cameraRef.current = fitted;
      setCameraSnapshot(fitted);
    }
    scheduleRedraw({ world: true, strokes: true });
  }, [replayRegion, scheduleRedraw]);

  const handleSelectRegion = useCallback(() => {
    setTool("region");
  }, []);

  const handleClearRegion = useCallback(() => {
    setReplayRegion(null);
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

  const handleBookmarkTeleport = useCallback((pt: Point, targetZoom: number, label: string) => {
    const { width, height } = viewportRef.current;
    const clZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    cameraRef.current = {
      x: Math.max(width / (2 * clZoom), Math.min(WORLD_WIDTH - width / (2 * clZoom), pt.x)),
      y: Math.max(height / (2 * clZoom), Math.min(WORLD_HEIGHT - height / (2 * clZoom), pt.y)),
      zoom: clZoom,
    };
    scheduleRedraw({ world: true, strokes: true });
    captureEvent("bookmark_teleport", { label });
  }, [scheduleRedraw]);

  const getBusiestPoint = useCallback(() => {
    return findBusiestCell(heatmapGridRef.current, WORLD_WIDTH, WORLD_HEIGHT);
  }, []);

  const getRandomActivePoint = useCallback(() => {
    return findRandomActiveCell(
      heatmapGridRef.current,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      { x: cameraRef.current.x, y: cameraRef.current.y },
    );
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
                  : tool === "text"
                    ? "cursor-text"
                    : tool === "shape" || tool === "ruler" || tool === "laser" || tool === "stencil" || tool === "eyedropper"
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

        <ProtectedZonesOverlay
          camera={cameraSnapshot}
          viewportWidth={viewportSize.width}
          viewportHeight={viewportSize.height}
          isAdmin={Boolean(adminPasscode)}
          onDeleteZone={handleDeleteProtectedZone}
        />

        {imagePlacement && (
          <AdminImageOverlay
            placement={imagePlacement}
            camera={cameraSnapshot}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
            onChangePlacement={setImagePlacement}
            onConfirmStamp={handleConfirmStampImage}
            onCancel={() => setImagePlacement(null)}
            onDeleteImage={() => setImagePlacement(null)}
            isStamping={isStampingImage}
          />
        )}

        {!replayDone && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-chrome-bg/80">
            <span className="font-mono text-sm tracking-wide text-ink-dim">
              {replayError ? "the wall couldn't load — reload to try again" : "loading the wall"}
              {!replayError && <span className="animate-pulse text-accent-green">…</span>}
            </span>
          </div>
        )}
      </main>

      {/* Admin Broadcast Announcement Ticker */}
      <AdminBroadcastBanner />

      {/* Sticky Floating Admin Status Badge */}
      {adminPasscode && (
        <div className="pointer-events-auto fixed top-14 left-4 z-50 flex items-center gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 px-3 py-1.5 font-mono text-xs font-bold text-accent-yellow shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setAdminOpen((prev) => !prev)}
            className="flex items-center gap-1.5 hover:underline"
            title="Click to toggle Admin Control Center"
          >
            <span className="h-2 w-2 rounded-full bg-accent-crimson animate-ping shrink-0" />
            <span>🛡️ ADMIN MODE</span>
          </button>
          <span className="text-chrome-border">|</span>
          <button
            type="button"
            onClick={handleLogoutAdmin}
            className="text-ink-dim hover:text-accent-crimson transition-colors"
            title="Log out of Admin Mode"
          >
            EXIT 🚪
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <header
        id="header-bar"
        role="banner"
        className="pointer-events-auto absolute inset-x-0 top-0 z-40 flex items-center justify-between border-b-2 border-rust/70 bg-chrome-bg/95 px-3 sm:px-4 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-sm"
      >
        <ChromeRivet className="top-1/2 left-2 -translate-y-1/2 hidden sm:block" />
        
        {/* Left Section: Branding & Info Badges */}
        <div className="flex shrink-0 items-center gap-2 pl-1 sm:pl-4">
          <h1 id="app-heading" className="stencil-cut font-display text-xs sm:text-sm font-bold tracking-[0.18em] sm:tracking-[0.22em] text-ink uppercase whitespace-nowrap">
            AlwaysDraw
          </h1>
          <div
            className="hidden sm:flex items-center gap-1 whitespace-nowrap rounded-sm border border-chrome-border bg-chrome-bg-raised/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink shadow-sm"
            title="Active 500x500 spatial tiles in current camera viewport"
          >
            <span className="text-ink-dim">{t(locale, "tiles")}:</span>
            <span className="font-bold text-accent-yellow">{visibleTileCount || 1}/1600</span>
          </div>
          <OnlineCount count={onlineCount ?? 0} locale={locale} />
        </div>

        {/* Desktop Controls (>= lg) — 4 Labeled Clusters */}
        {/* No overflow-x-auto here: dropdown panels render `absolute top-full`
            beneath their trigger inside this row, and per the CSS overflow
            spec, giving overflow-x anything but visible silently forces
            overflow-y to auto too — clipping every dropdown and breaking its
            click hit-testing. shrink-0 below already stops pills from being
            squashed into wrapping; letting the row itself overflow visually
            in extreme cases is the safer tradeoff. */}
        <div className="hidden xl:flex items-center gap-3 pr-4">
          {/* Cluster 1: View & Display */}
          <div className="flex shrink-0 items-center gap-2" title="View & Display Settings">
            <LanguagePicker
              currentLocale={locale}
              onLocaleChange={(loc) => {
                setLocale(loc);
                localStorage.setItem("alwaysdraw_locale", loc);
              }}
            />
            <ThemeToggle />
            <GridToggle config={gridConfig} onChange={setGridConfig} locale={locale} />
            <UsernameControl username={username} onUsernameChange={handleUsernameChange} locale={locale} />
          </div>

          <HeaderSeam />

          {/* Cluster 2: Spatial Navigation */}
          <div className="flex shrink-0 items-center gap-2" title="Spatial Navigation & Teleportation">
            <SpatialCompass camera={cameraSnapshot} onTeleport={handleJumpToPoint} locale={locale} />
            <ExploreMenu
              onJumpToPoint={handleJumpToPoint}
              getBusiestPoint={getBusiestPoint}
              getRandomActivePoint={getRandomActivePoint}
              getLatestActivityPoint={getLatestActivityPoint}
              onlineCount={onlineCount ?? 1}
              locale={locale}
            />
            <BookmarkMenu
              currentCamera={cameraSnapshot}
              clientId={clientId}
              onTeleport={handleBookmarkTeleport}
              locale={locale}
            />
            <CommunityGalleryModal
              clientId={clientId}
              username={username}
              onTeleport={handleBookmarkTeleport}
              locale={locale}
            />
          </div>

          <HeaderSeam />

          {/* Cluster 3: Timeline & Export */}
          <div className="flex shrink-0 items-center gap-2" title="Timeline & Export Tools">
            <TimeTravelMenu
              isReplayMode={isReplayMode}
              isPlaying={isPlayingReplay}
              currentSequence={replaySequenceIndex}
              minSequence={minSequence}
              maxSequence={maxSequence}
              playbackSpeed={playbackSpeed}
              onTogglePlay={() => setIsPlayingReplay((v) => !v)}
              onSeek={(seq) => setReplaySequenceIndex(seq)}
              onStep={(delta) =>
                setReplaySequenceIndex((prev) =>
                  Math.max(minSequence, Math.min(maxSequence, prev + delta)),
                )
              }
              onSpeedChange={setPlaybackSpeed}
              onExitReplay={() => {
                setIsReplayMode(false);
                setIsPlayingReplay(false);
                scheduleRedraw({ world: true, strokes: true });
              }}
              onEnterReplay={handleEnterReplay}
              region={replayRegion}
              onSelectRegion={handleSelectRegion}
              onClearRegion={handleClearRegion}
              locale={locale}
            />
            <ExportModal
              getCanvasLayers={() => [worldCanvasRef.current, canvasRef.current, heatmapCanvasRef.current]}
              getCommittedStrokes={() => committedRef.current}
              currentCamera={cameraSnapshot}
              viewportWidth={viewportSize.width}
              viewportHeight={viewportSize.height}
              worldWidth={WORLD_WIDTH}
              worldHeight={WORLD_HEIGHT}
              region={replayRegion}
              locale={locale}
            />
          </div>

          <HeaderSeam />

          {/* Cluster 4: Help & Status */}
          <div className="flex shrink-0 items-center gap-2" title="Help & System Status">
            <HotkeysModal isOpen={hotkeysOpen} onToggle={() => setHotkeysOpen((v) => !v)} locale={locale} />
            <HelpModal />
            <ConnectionStatus locale={locale} />
          </div>
        </div>

        {/* Mobile Hamburger Button Controls (< xl) */}
        <div className="flex items-center gap-2 xl:hidden pr-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-chrome-border bg-chrome-bg-raised px-2.5 py-1 font-mono text-xs font-bold text-ink uppercase shadow-sm transition hover:bg-chrome-bg-recessed active:scale-95"
            aria-label="Toggle Mobile Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <>
                <span className="text-accent-crimson text-sm font-black">✕</span>
                <span>{t(locale, "close")}</span>
              </>
            ) : (
              <>
                <span className="text-accent-yellow text-sm font-black">☰</span>
                <span>{t(locale, "menu")}</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile Drawer Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden absolute right-0 top-full z-50 mt-2 w-max max-w-[calc(100vw-1.5rem)] rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-md">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-chrome-border/60 pb-1.5 font-mono text-[11px] font-bold text-ink-dim uppercase">
              <span className="whitespace-nowrap">🛠️ {t(locale, "canvas_tools_panels")}</span>
              <span className="whitespace-nowrap text-accent-yellow">{t(locale, "tiles")}: {visibleTileCount || 1}/1600</span>
            </div>

            <MobileGroupLabel>🌐 {t(locale, "group_view_display")}</MobileGroupLabel>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <LanguagePicker
                currentLocale={locale}
                onLocaleChange={(loc) => {
                  setLocale(loc);
                  localStorage.setItem("alwaysdraw_locale", loc);
                }}
              />
              <ThemeToggle />
              <GridToggle config={gridConfig} onChange={setGridConfig} locale={locale} />
              <UsernameControl username={username} onUsernameChange={handleUsernameChange} locale={locale} />
            </div>

            <MobileGroupLabel>🧭 {t(locale, "group_spatial_nav")}</MobileGroupLabel>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <SpatialCompass camera={cameraSnapshot} onTeleport={handleJumpToPoint} locale={locale} />
              <ExploreMenu
                onJumpToPoint={handleJumpToPoint}
                getBusiestPoint={getBusiestPoint}
                getRandomActivePoint={getRandomActivePoint}
                getLatestActivityPoint={getLatestActivityPoint}
                onlineCount={onlineCount ?? 1}
                locale={locale}
              />
              <BookmarkMenu
                currentCamera={cameraSnapshot}
                clientId={clientId}
                onTeleport={handleBookmarkTeleport}
                locale={locale}
              />
              <CommunityGalleryModal
                clientId={clientId}
                username={username}
                onTeleport={handleBookmarkTeleport}
                locale={locale}
              />
            </div>

            <MobileGroupLabel>🎥 {t(locale, "group_timeline_export")}</MobileGroupLabel>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <TimeTravelMenu
                isReplayMode={isReplayMode}
                isPlaying={isPlayingReplay}
                currentSequence={replaySequenceIndex}
                minSequence={minSequence}
                maxSequence={maxSequence}
                playbackSpeed={playbackSpeed}
                onTogglePlay={() => setIsPlayingReplay((v) => !v)}
                onSeek={(seq) => setReplaySequenceIndex(seq)}
                onStep={(delta) =>
                  setReplaySequenceIndex((prev) =>
                    Math.max(minSequence, Math.min(maxSequence, prev + delta)),
                  )
                }
                onSpeedChange={setPlaybackSpeed}
                onExitReplay={() => {
                  setIsReplayMode(false);
                  setIsPlayingReplay(false);
                  scheduleRedraw({ world: true, strokes: true });
                }}
                onEnterReplay={handleEnterReplay}
                region={replayRegion}
                onSelectRegion={handleSelectRegion}
                onClearRegion={handleClearRegion}
                locale={locale}
              />
              <ExportModal
                getCanvasLayers={() => [worldCanvasRef.current, canvasRef.current, heatmapCanvasRef.current]}
                getCommittedStrokes={() => committedRef.current}
                currentCamera={cameraSnapshot}
                viewportWidth={viewportSize.width}
                viewportHeight={viewportSize.height}
                worldWidth={WORLD_WIDTH}
                worldHeight={WORLD_HEIGHT}
                region={replayRegion}
                locale={locale}
              />
            </div>

            <MobileGroupLabel>❓ {t(locale, "group_help_status")}</MobileGroupLabel>
            <div className="flex flex-wrap items-center gap-2">
              <HotkeysModal isOpen={hotkeysOpen} onToggle={() => setHotkeysOpen((v) => !v)} locale={locale} />
              <HelpModal />
              <ConnectionStatus locale={locale} />
            </div>
          </div>
        )}
        <ChromeRivet className="top-1/2 right-2 -translate-y-1/2 hidden sm:block" />
      </header>

      {submitError && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2">
          <div className="rounded-sm border border-accent-crimson-deep bg-chrome-bg-raised px-3 py-1.5 text-xs text-ink shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {submitError}
          </div>
        </div>
      )}

      {hoverAttribution && (
        <div
          className="pointer-events-none absolute z-50 -translate-y-full"
          style={{ left: hoverAttribution.screenX + 14, top: hoverAttribution.screenY - 10 }}
        >
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-chrome-border bg-chrome-bg/95 px-2 py-1 font-mono text-[11px] font-bold text-ink shadow-[0_4px_12px_rgba(0,0,0,0.7)] backdrop-blur-sm">
            <span>{countryCodeToFlag(hoverAttribution.countryCode)}</span>
            <span>{hoverAttribution.username ?? hoverAttribution.clientId}</span>
          </div>
        </div>
      )}

      {shapeMetricsLabel && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-sm border border-rust bg-chrome-bg/95 px-3 py-1.5 font-mono text-xs font-bold text-accent-yellow shadow-[0_4px_16px_rgba(0,0,0,0.85)] backdrop-blur-md">
          📐 {shapeMetricsLabel}
        </div>
      )}

      {tool === "region" && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-sm border border-accent-yellow bg-chrome-bg/95 px-3 py-1.5 font-mono text-xs font-bold text-accent-yellow shadow-[0_4px_16px_rgba(0,0,0,0.85)] backdrop-blur-md">
          ⬚ {t(locale, "region_select_hint")}
        </div>
      )}

      <CommentsOverlay
        comments={comments}
        camera={cameraSnapshot}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        onDeleteComment={handleDeleteComment}
      />

      {commentInputPos && (
        <div
          className="absolute z-50 -translate-y-full"
          style={{ left: commentInputPos.screen.x, top: commentInputPos.screen.y - 10 }}
        >
          <form
            onSubmit={handleSubmitComment}
            className="flex w-56 flex-col gap-1.5 rounded-sm border-2 border-rust bg-chrome-bg/95 p-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.85)] backdrop-blur-md"
          >
            <textarea
              autoFocus
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCommentInputPos(null);
                  setCommentText("");
                }
              }}
              placeholder={t(locale, "gallery_comment_placeholder")}
              maxLength={MAX_COMMENT_LENGTH}
              rows={2}
              className="w-full resize-none rounded-sm border border-chrome-border bg-chrome-bg-raised px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-dim/50 focus:border-rust focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCommentInputPos(null);
                  setCommentText("");
                }}
                className="rounded-sm border border-chrome-border bg-chrome-bg px-2.5 py-1 font-mono text-[10px] font-bold text-ink-dim transition-colors hover:border-rust hover:text-accent-crimson"
              >
                {t(locale, "close")}
              </button>
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="rounded-sm border border-rust bg-rust/30 px-2.5 py-1 font-mono text-[10px] font-bold text-ink transition-colors hover:bg-rust hover:text-white disabled:opacity-40"
              >
                📌 {t(locale, "save").toUpperCase()}
              </button>
            </div>
          </form>
        </div>
      )}

      <FpsHud isOpen={fpsHudOpen} />
      <RateLimitToast />

      <nav id="drawing-toolbar-nav" aria-label="Drawing Tools Toolbar">
        <DrawingToolbar
          tool={tool}
          onToolChange={handleToolChange}
          brushType={brushType}
          onBrushTypeChange={setBrushType}
          shapeType={shapeType}
          onShapeTypeChange={setShapeType}
          selectedStencil={selectedStencil}
          onStencilSelect={setSelectedStencil}
          selectedSticker={selectedSticker}
          onStickerSelect={setSelectedSticker}
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
          symmetryMode={symmetryMode}
          onSymmetryModeChange={setSymmetryMode}
          showHeatmap={showHeatmap}
          onToggleHeatmap={handleToggleHeatmap}
          locale={locale}
        />
        <AdminPanelModal
          isOpen={adminOpen}
          onClose={() => setAdminOpen(false)}
          authenticated={Boolean(adminPasscode)}
          passcode={adminPasscode}
          onAuthenticate={handleAuthenticateAdmin}
          onStartImagePlacement={handleStartImagePlacement}
          onPurgeAllStampedImages={handlePurgeAllStampedImages}
        />
      </nav>

      {textInputPos && (
        <div
          className="fixed z-50 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-md w-[320px] flex flex-col gap-2.5"
          style={{
            left: Math.min(Math.max(10, textInputPos.screen.x), (viewportSize.width || 800) - 330),
            top: Math.min(Math.max(10, textInputPos.screen.y), (viewportSize.height || 600) - 220),
          }}
        >
          <div className="flex items-center justify-between border-b border-chrome-border/60 pb-1.5 font-mono text-xs font-bold uppercase text-accent-yellow">
            <span>✍️ Insert Vector Text</span>
            <button
              type="button"
              onClick={() => setTextInputPos(null)}
              className="text-ink-dim hover:text-ink text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <input
            type="text"
            autoFocus
            value={textInputText}
            onChange={(e) => setTextInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommitText();
              if (e.key === "Escape") setTextInputPos(null);
            }}
            placeholder="Type text to draw on canvas..."
            className="w-full rounded-sm border border-chrome-border bg-chrome-bg-raised px-2.5 py-1.5 font-mono text-xs text-ink focus:border-rust focus:outline-none"
          />

          <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
            <select
              value={textStyle}
              onChange={(e) => setTextStyle(e.target.value as FontStyle)}
              className="flex-1 rounded-sm border border-chrome-border bg-chrome-bg-raised px-2 py-1 text-ink focus:outline-none"
            >
              {FONT_STYLES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              className="w-20 rounded-sm border border-chrome-border bg-chrome-bg-raised px-2 py-1 text-ink focus:outline-none"
            >
              <option value={20}>20px</option>
              <option value={32}>32px</option>
              <option value={48}>48px</option>
              <option value={64}>64px</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setTextInputPos(null)}
              className="rounded-sm border border-chrome-border px-3 py-1 font-mono text-xs font-bold text-ink-dim hover:bg-chrome-bg hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommitText}
              className="rounded-sm border border-accent-crimson-deep bg-accent-crimson-deep px-3 py-1 font-mono text-xs font-bold text-on-accent hover:brightness-110 shadow-md"
            >
              Place Text
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
