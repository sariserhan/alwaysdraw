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
import { CommentsOverlay, type CanvasComment, type CommentsOverlayHandle } from "./CommentsOverlay";
import { parseCameraFromSearch, cameraToSearchString } from "@/lib/viewportUrl";
import { captureEvent, captureOperationalError } from "@/lib/observability";
import type { LocalStroke, ServerStroke, Point, Tool, BrushType, WorldRect } from "@/lib/types";
import { normalizeRect, strokeIntersectsRegion, fitCameraToRegion } from "@/lib/regionFilter";
import { DrawingToolbar } from "./DrawingToolbar";
import { OnlineCount } from "./OnlineCount";
import { ConnectionStatus } from "./ConnectionStatus";
import { RemoteCursors, type RemoteCursorsHandle } from "./RemoteCursors";
import { ThemeToggle } from "./ThemeToggle";
import { ChromeRivet } from "./ChromeRivet";
import { MobileGroupLabel } from "./HeaderSeam";
import { BrushCursor } from "./BrushCursor";
import { MagnifierLoupe } from "./MagnifierLoupe";
import { RulerOverlay } from "./RulerOverlay";
import { CoordFinderOverlay } from "./CoordFinderOverlay";
import { MiniMap, MINI_MAP_SIZE_PX, useHeaderBottomOffset } from "./MiniMap";
import { TimeTravelMenu } from "./ReplayBar";
import { ExploreMenu } from "./ExploreMenu";
import { BookmarkMenu } from "./BookmarkMenu";
import { ReportButton } from "./ReportButton";
import { CommunityGalleryModal } from "./CommunityGalleryModal";
import { ExportModal } from "./ExportModal";
import { LanguagePicker } from "./LanguagePicker";
import { HotkeysModal } from "./HotkeysModal";
import { AdminPanelModal } from "./AdminPanelModal";
import { AdminBroadcastBanner } from "./AdminBroadcastBanner";
import { AdminImageOverlay, type AdminImagePlacement } from "./AdminImageOverlay";
import { ProtectedZonesOverlay, type ProtectedZonesOverlayHandle } from "./ProtectedZonesOverlay";
import { t, type Locale } from "@/lib/i18n";
import { HelpModal } from "./HelpModal";
import { GridToggle } from "./GridToggle";
import { HideCommentsToggle } from "./HideCommentsToggle";
import { UsernameControl } from "./UsernameControl";
import { SpatialCompass } from "./SpatialCompass";
import { ZoomPill } from "./ZoomPill";
import { ShareButton } from "./ShareButton";
import { HeatmapToggle } from "./HeatmapToggle";
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
const HOVER_SCREEN_RADIUS_PX = 8;
const REPLAY_PAGE_SIZE = 1000;
const HEATMAP_GRID_SIZE = 32;
// No server-side canvas renderer exists (Convex functions can't draw), so a
// snapshot can only ever be produced by a real browser that already has the
// full stroke history loaded. Whichever client finishes replay with enough
// new strokes since the last snapshot renders one and submits it in the
// background — self-sustaining, no cron/admin action required. Harmless if
// two clients race: snapshots.submit dedupes by exact sequence, and
// SNAPSHOTS_GLOBAL_WINDOW bounds the worst case to a handful of redundant
// writes, not an unbounded stampede.
const SNAPSHOT_STROKE_THRESHOLD = 500;
const SNAPSHOT_SIZE_PX = 2048;
// Every open tab heartbeats forever regardless of activity, and each one is
// a full presence-table write that reactively re-pushes to every other
// connected client's cursor subscription — a cost floor that scales with
// how many tabs are merely open, not how many people are actually doing
// anything. Backing off once idle cuts that floor for the common case
// (someone glancing at the wall, or a background tab) without touching
// online-status accuracy: HEARTBEAT_IDLE_INTERVAL_MS still stays well under
// PRESENCE_ONLINE_WINDOW_MS (30s), so nobody flips to "offline" just because
// their mouse stopped moving.
const HEARTBEAT_ACTIVE_INTERVAL_MS = 3000;
const HEARTBEAT_IDLE_INTERVAL_MS = 15000;
const HEARTBEAT_IDLE_THRESHOLD_MS = 10000;
// Remote cursors subscribe per-tile instead of globally (presence.listByTiles)
// so a cursor move somewhere off-screen never re-pushes to a viewer who
// can't see it. That only pays off when "visible tiles" is a small fraction
// of the world — someone zoomed out far enough to see most/all of it would
// just be subscribing to everything anyway, so past this many visible tiles
// the query is skipped entirely and remote cursors simply don't render,
// rather than firing hundreds of per-tile lookups or falling back to a
// global read. The world's online count (header) is unaffected either way —
// that's a separate, already-cheap query.
const MAX_SCOPED_PRESENCE_TILES = 100;

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
  const commentsOverlayRef = useRef<CommentsOverlayHandle>(null);
  const protectedZonesOverlayRef = useRef<ProtectedZonesOverlayHandle>(null);
  const remoteCursorsRef = useRef<RemoteCursorsHandle>(null);
  const lastScreenPosRef = useRef<Point | null>(null);
  const shapeDragRef = useRef<{ start: Point; current: Point } | null>(null);
  const shapePreviewRef = useRef<LocalStroke | null>(null);
  const regionDragRef = useRef<{ start: Point; current: Point } | null>(null);
  const [replayRegion, setReplayRegion] = useState<WorldRect | null>(null);
  // Drag-marked rectangle for the "report a specific area" flow — distinct
  // from regionDragRef/replayRegion (Time Travel/Export scoping) since both
  // can be mid-use independently. pendingReportRegion is the just-finished
  // selection waiting to be submitted or cleared from ReportButton's panel;
  // highlightedReportRegion is what an admin sees after clicking "teleport"
  // on an already-submitted rect-based report — never shown to other users.
  const reportRegionDragRef = useRef<{ start: Point; current: Point } | null>(null);
  const [pendingReportRegion, setPendingReportRegion] = useState<WorldRect | null>(null);
  const [highlightedReportRegion, setHighlightedReportRegion] = useState<WorldRect | null>(null);
  // Same drag-a-rectangle mechanism, for the admin "purge this area" flow —
  // the admin panel closes itself while dragging (see the tool's pointer-up
  // handler), then reopens once a rectangle is marked.
  const adminWipeRegionDragRef = useRef<{ start: Point; current: Point } | null>(null);
  const [pendingWipeRegion, setPendingWipeRegion] = useState<WorldRect | null>(null);
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
  const coordFinderElRef = useRef<HTMLDivElement>(null);
  const coordFinderDragRef = useRef<{
    startWorld: Point;
    currentWorld: Point;
  } | null>(null);
  const lastCoordFinderPointerRef = useRef<{
    world: Point;
    screen: Point;
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
  // Mirrors committedRef, bucketed by tile, so a tile-scoped lookup (hover
  // attribution) doesn't have to linearly scan every stroke the wall has
  // ever had just to find the handful in one tile — kept in sync at every
  // site that pushes to or removes from committedRef.
  const strokesByTileRef = useRef<Map<string, ServerStroke[]>>(new Map());
  const addToTileIndex = useCallback((stroke: ServerStroke) => {
    if (!stroke.tiles || stroke.tiles.length === 0) return;
    for (const tileId of stroke.tiles) {
      const bucket = strokesByTileRef.current.get(tileId);
      if (bucket) bucket.push(stroke);
      else strokesByTileRef.current.set(tileId, [stroke]);
    }
  }, []);
  const removeFromTileIndex = useCallback((clientStrokeId: string, tiles: string[] | undefined) => {
    if (!tiles || tiles.length === 0) return;
    for (const tileId of tiles) {
      const bucket = strokesByTileRef.current.get(tileId);
      if (!bucket) continue;
      const next = bucket.filter((s) => s.clientStrokeId !== clientStrokeId);
      if (next.length > 0) strokesByTileRef.current.set(tileId, next);
      else strokesByTileRef.current.delete(tileId);
    }
  }, []);
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

  const [tool, setTool] = useState<Tool>("laser");
  const [brushType, setBrushType] = useState<BrushType>("brush");
  const [shapeType, setShapeType] = useState<ShapeType>("line");
  const [selectedStencil, setSelectedStencil] = useState<StencilType>("biohazard");
  const [color, setColor] = useState("#17181a");
  const [brushWidth, setBrushWidth] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(() => Math.round(initialCamera.zoom * 100));
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
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
  const [commentInputPos, setCommentInputPos] = useState<{ world: Point; screen: { x: number; y: number } } | null>(null);
  const [commentText, setCommentText] = useState("");

  const verifyAdminPasscode = useMutation(api.admin.verifyPasscode);
  const rollbackClient = useMutation(api.admin.rollbackClient);
  const deleteProtectedZone = useMutation(api.admin.deleteProtectedZone);
  const wipeAreaMutation = useMutation(api.admin.wipeArea);

  const handleDeleteProtectedZone = useCallback(async (zoneId: string) => {
    if (!adminPasscode) return;
    try {
      await deleteProtectedZone({ passcode: adminPasscode, zoneId: zoneId as Id<"protectedZones"> });
    } catch {
      setSubmitError("couldn't unlock that zone — try again");
    }
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
  const [showComments, setShowComments] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("alwaysdraw_show_comments") !== "false";
    }
    return true;
  });
  const toggleShowComments = useCallback(() => {
    setShowComments((prev) => {
      const next = !prev;
      localStorage.setItem("alwaysdraw_show_comments", String(next));
      return next;
    });
  }, []);
  // Desktop sidebar sticks directly under the mini-map, which itself sticks
  // under the header — chained offsets so both stay aligned as the header's
  // height changes (it wraps to 1-3 rows depending on viewport width).
  const sidebarTop = useHeaderBottomOffset(MINI_MAP_SIZE_PX + 12);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const adminRemoveComment = useMutation(api.comments.adminRemove);
  const reportContent = useMutation(api.reports.create);
  const submitSnapshot = useMutation(api.snapshots.submit);

  const onlineCount = useQuery(api.presence.onlineCount);
  const [subscribedTileKeys, setSubscribedTileKeys] = useState<string[]>([]);
  const subscribedTileKeysRef = useRef<string[]>([]);
  const presenceList = useQuery(
    api.presence.listByTiles,
    subscribedTileKeys.length > 0 && subscribedTileKeys.length <= MAX_SCOPED_PRESENCE_TILES
      ? { tileKeys: subscribedTileKeys }
      : "skip",
  );
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

    // "Report a specific area" rectangle — the live drag while marking it,
    // then the confirmed selection while the report form is still open. This
    // is local-only, never synced or shown to other users.
    const liveReportRegionDrag = reportRegionDragRef.current;
    const reportRegionToDraw = liveReportRegionDrag
      ? normalizeRect(liveReportRegionDrag.start, liveReportRegionDrag.current)
      : pendingReportRegion;
    if (reportRegionToDraw) {
      const topLeft = worldToScreen(reportRegionToDraw.minX, reportRegionToDraw.minY, cameraRef.current, width, height);
      const bottomRight = worldToScreen(reportRegionToDraw.maxX, reportRegionToDraw.maxY, cameraRef.current, width, height);
      ctx.save();
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.restore();
    }

    // Admin-only: the marked rectangle of a report just jumped to from the
    // Reports queue — never shown to anyone but the admin who clicked it,
    // and never persisted (cleared a few seconds after teleporting in).
    if (highlightedReportRegion) {
      const topLeft = worldToScreen(highlightedReportRegion.minX, highlightedReportRegion.minY, cameraRef.current, width, height);
      const bottomRight = worldToScreen(highlightedReportRegion.maxX, highlightedReportRegion.maxY, cameraRef.current, width, height);
      ctx.save();
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.restore();
    }

    // Admin "purge this area" rectangle — solid red fill so it reads as
    // destructive, not just another selection outline.
    const liveWipeRegionDrag = adminWipeRegionDragRef.current;
    const wipeRegionToDraw = liveWipeRegionDrag
      ? normalizeRect(liveWipeRegionDrag.start, liveWipeRegionDrag.current)
      : pendingWipeRegion;
    if (wipeRegionToDraw) {
      const topLeft = worldToScreen(wipeRegionToDraw.minX, wipeRegionToDraw.minY, cameraRef.current, width, height);
      const bottomRight = worldToScreen(wipeRegionToDraw.maxX, wipeRegionToDraw.maxY, cameraRef.current, width, height);
      ctx.save();
      ctx.fillStyle = "rgba(192, 57, 43, 0.2)";
      ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.restore();
    }
  }, [paintOneStroke, isReplayMode, replaySequenceIndex, visibleTileCount, tool, selectedStencil, brushWidth, color, replayRegion, pendingReportRegion, highlightedReportRegion, pendingWipeRegion]);

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

  const updateCoordFinder = useCallback(() => {
    const el = coordFinderElRef.current;
    if (!el) return;

    if (tool !== "coordFinder") {
      el.style.display = "none";
      return;
    }

    el.style.display = "block";

    const cursorBadge = el.querySelector<HTMLDivElement>("[data-coord-cursor-badge]");
    const rectEl = el.querySelector<SVGRectElement>("[data-coord-rect]");
    const nwNode = el.querySelector<SVGCircleElement>("[data-coord-nw-node]");
    const neNode = el.querySelector<SVGCircleElement>("[data-coord-ne-node]");
    const swNode = el.querySelector<SVGCircleElement>("[data-coord-sw-node]");
    const seNode = el.querySelector<SVGCircleElement>("[data-coord-se-node]");

    const nwBadge = el.querySelector<HTMLDivElement>("[data-coord-nw-badge]");
    const neBadge = el.querySelector<HTMLDivElement>("[data-coord-ne-badge]");
    const swBadge = el.querySelector<HTMLDivElement>("[data-coord-sw-badge]");
    const seBadge = el.querySelector<HTMLDivElement>("[data-coord-se-badge]");
    const centerCard = el.querySelector<HTMLDivElement>("[data-coord-center-card]");

    const ptr = lastCoordFinderPointerRef.current;
    if (ptr && cursorBadge) {
      cursorBadge.style.display = "block";
      cursorBadge.style.left = `${ptr.screen.x}px`;
      cursorBadge.style.top = `${ptr.screen.y}px`;
      cursorBadge.innerHTML = `🎯 X: ${Math.round(ptr.world.x)}, Y: ${Math.round(ptr.world.y)}`;
    } else if (cursorBadge) {
      cursorBadge.style.display = "none";
    }

    const drag = coordFinderDragRef.current;
    if (!drag) {
      if (rectEl) rectEl.setAttribute("width", "0");
      if (nwNode) nwNode.setAttribute("r", "0");
      if (neNode) neNode.setAttribute("r", "0");
      if (swNode) swNode.setAttribute("r", "0");
      if (seNode) seNode.setAttribute("r", "0");
      if (nwBadge) nwBadge.style.display = "none";
      if (neBadge) neBadge.style.display = "none";
      if (swBadge) swBadge.style.display = "none";
      if (seBadge) seBadge.style.display = "none";
      if (centerCard) centerCard.style.display = "none";
      return;
    }

    const { width, height } = viewportRef.current;
    const camera = cameraRef.current;
    const startScreen = worldToScreen(drag.startWorld.x, drag.startWorld.y, camera, width, height);
    const currentScreen = worldToScreen(drag.currentWorld.x, drag.currentWorld.y, camera, width, height);

    const screenMinX = Math.min(startScreen.x, currentScreen.x);
    const screenMaxX = Math.max(startScreen.x, currentScreen.x);
    const screenMinY = Math.min(startScreen.y, currentScreen.y);
    const screenMaxY = Math.max(startScreen.y, currentScreen.y);
    const screenW = screenMaxX - screenMinX;
    const screenH = screenMaxY - screenMinY;

    const minX = Math.round(Math.min(drag.startWorld.x, drag.currentWorld.x));
    const maxX = Math.round(Math.max(drag.startWorld.x, drag.currentWorld.x));
    const minY = Math.round(Math.min(drag.startWorld.y, drag.currentWorld.y));
    const maxY = Math.round(Math.max(drag.startWorld.y, drag.currentWorld.y));
    const widthFt = Math.max(0, maxX - minX);
    const heightFt = Math.max(0, maxY - minY);
    const areaSqFt = widthFt * heightFt;

    if (rectEl) {
      rectEl.setAttribute("x", String(screenMinX));
      rectEl.setAttribute("y", String(screenMinY));
      rectEl.setAttribute("width", String(screenW));
      rectEl.setAttribute("height", String(screenH));
    }

    if (nwNode) { nwNode.setAttribute("cx", String(screenMinX)); nwNode.setAttribute("cy", String(screenMinY)); nwNode.setAttribute("r", "5"); }
    if (neNode) { neNode.setAttribute("cx", String(screenMaxX)); neNode.setAttribute("cy", String(screenMinY)); neNode.setAttribute("r", "5"); }
    if (swNode) { swNode.setAttribute("cx", String(screenMinX)); swNode.setAttribute("cy", String(screenMaxY)); swNode.setAttribute("r", "5"); }
    if (seNode) { seNode.setAttribute("cx", String(screenMaxX)); seNode.setAttribute("cy", String(screenMaxY)); seNode.setAttribute("r", "5"); }

    if (nwBadge) {
      nwBadge.style.display = "block";
      nwBadge.style.left = `${screenMinX}px`;
      nwBadge.style.top = `${screenMinY}px`;
      nwBadge.innerHTML = `📍 NW: (${minX}, ${minY})`;
    }
    if (neBadge) {
      neBadge.style.display = "block";
      neBadge.style.left = `${screenMaxX}px`;
      neBadge.style.top = `${screenMinY}px`;
      neBadge.innerHTML = `📍 NE: (${maxX}, ${minY})`;
    }
    if (swBadge) {
      swBadge.style.display = "block";
      swBadge.style.left = `${screenMinX}px`;
      swBadge.style.top = `${screenMaxY}px`;
      swBadge.innerHTML = `📍 SW: (${minX}, ${maxY})`;
    }
    if (seBadge) {
      seBadge.style.display = "block";
      seBadge.style.left = `${screenMaxX}px`;
      seBadge.style.top = `${screenMaxY}px`;
      seBadge.innerHTML = `📍 SE: (${maxX}, ${maxY})`;
    }

    if (centerCard) {
      centerCard.style.display = "flex";
      centerCard.style.left = `${(screenMinX + screenMaxX) / 2}px`;
      centerCard.style.top = `${(screenMinY + screenMaxY) / 2}px`;
      centerCard.innerHTML = `
        <div class="flex items-center justify-between border-b border-chrome-border/60 pb-1 font-bold text-accent-yellow">
          <span>📐 ${areaSqFt.toLocaleString()} sq ft</span>
          <span class="text-ink-dim pl-2">${widthFt.toLocaleString()} ft × ${heightFt.toLocaleString()} ft</span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-ink-dim pt-0.5">
          <span>Corner Bounds:</span>
          <span class="font-bold text-ink pl-2">X:[${minX}..${maxX}] Y:[${minY}..${maxY}]</span>
        </div>
      `;
    }
  }, [tool]);

  useEffect(() => {
    if (tool !== "ruler") rulerDragRef.current = null;
    if (tool !== "coordFinder") {
      coordFinderDragRef.current = null;
      lastCoordFinderPointerRef.current = null;
    }
    updateRuler();
    updateCoordFinder();
  }, [tool, updateRuler, updateCoordFinder]);

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
        commentsOverlayRef.current?.syncPositions(
          cameraRef.current,
          viewportRef.current.width,
          viewportRef.current.height,
        );
        remoteCursorsRef.current?.syncPositions(
          cameraRef.current,
          viewportRef.current.width,
          viewportRef.current.height,
        );
        protectedZonesOverlayRef.current?.syncPositions(
          cameraRef.current,
          viewportRef.current.width,
          viewportRef.current.height,
          lastCursorWorldRef.current,
        );

        // Drives the tile-scoped presence subscription (see
        // MAX_SCOPED_PRESENCE_TILES) — only updates state, and so only
        // triggers a requery, when the actual set of visible tiles changes
        // (crossing a tile boundary), not on every pan pixel.
        const visibleTileKeysNow = getVisibleTileKeys(
          cameraRef.current,
          viewportRef.current.width,
          viewportRef.current.height,
          WORLD_WIDTH,
          WORLD_HEIGHT,
          TILE_SIZE,
          1,
        );
        const prevTileKeys = subscribedTileKeysRef.current;
        const tileKeysChanged =
          visibleTileKeysNow.length !== prevTileKeys.length ||
          visibleTileKeysNow.some((k, i) => k !== prevTileKeys[i]);
        if (tileKeysChanged) {
          subscribedTileKeysRef.current = visibleTileKeysNow;
          setSubscribedTileKeys(visibleTileKeysNow);
        }
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
            if (s.deleted) {
              // The original stroke and its later tombstone can both land
              // in this same delta range (created and deleted before this
              // client's first load) — drop it rather than replay it. If
              // the original predates the snapshot cutoff instead, it's
              // baked into the snapshot image with nothing here to remove;
              // that's a pre-existing snapshot limitation, not new here —
              // it self-heals whenever the snapshot is next regenerated.
              committedRef.current = committedRef.current.filter((c) => c.clientStrokeId !== s.clientStrokeId);
              removeFromTileIndex(s.clientStrokeId, s.tiles);
            } else {
              committedRef.current.push(s);
              addToTileIndex(s);
            }
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

          if (after - snapshotSequenceRef.current >= SNAPSHOT_STROKE_THRESHOLD) {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = SNAPSHOT_SIZE_PX;
              canvas.height = SNAPSHOT_SIZE_PX;
              const snapshotCtx = canvas.getContext("2d");
              if (snapshotCtx) {
                fillMiniMapBackground(snapshotCtx, SNAPSHOT_SIZE_PX);
                paintMiniMapStrokes(snapshotCtx, committedRef.current, SNAPSHOT_SIZE_PX, WORLD_WIDTH, WORLD_HEIGHT);
                await submitSnapshot({
                  sequence: after,
                  imageData: canvas.toDataURL("image/png"),
                  strokeCount: committedRef.current.length,
                });
              }
            } catch (snapshotError) {
              // Non-critical background optimization — the next client past
              // the threshold will just try again.
              captureOperationalError(snapshotError, "snapshot_generate", { sequence: after });
            }
          }
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
      let anyRemoved = false;
      for (const s of liveTail) {
        if (s.deleted) {
          // A tombstone patch reuses its original clientStrokeId (it's the
          // same row, not a new one) — so it must bypass the dedup check
          // below rather than be skipped by it, unlike a genuinely new
          // stroke sharing an id it's already seen.
          const before = committedRef.current.length;
          committedRef.current = committedRef.current.filter((c) => c.clientStrokeId !== s.clientStrokeId);
          if (committedRef.current.length !== before) anyRemoved = true;
          removeFromTileIndex(s.clientStrokeId, s.tiles);
          continue;
        }
        if (appliedIdsRef.current.has(s.clientStrokeId)) continue;
        appliedIdsRef.current.add(s.clientStrokeId);
        pendingRef.current.delete(s.clientStrokeId);
        committedRef.current.push(s);
        addToTileIndex(s);
        newlyApplied.push(s);
      }
      const lastSeq = liveTail[liveTail.length - 1].sequence;
      setMaxSequence(lastSeq);
      if (newlyApplied.length > 0 || anyRemoved) {
        scheduleRedraw();
        if (miniMapCtxRef.current && miniMapCanvasRef.current) {
          if (anyRemoved) {
            // A removal can't be un-painted from the mini-map's incremental
            // draw, so repaint it from scratch off the (now-shrunk) full
            // stroke list instead of just the newly-applied delta.
            fillMiniMapBackground(miniMapCtxRef.current, miniMapCanvasRef.current.width);
            paintMiniMapStrokes(
              miniMapCtxRef.current,
              committedRef.current,
              miniMapCanvasRef.current.width,
              WORLD_WIDTH,
              WORLD_HEIGHT,
            );
          } else {
            paintMiniMapStrokes(
              miniMapCtxRef.current,
              newlyApplied,
              miniMapCanvasRef.current.width,
              WORLD_WIDTH,
              WORLD_HEIGHT,
            );
          }
        }
        if (newlyApplied.length > 0) {
          addStrokesToHeatmap(heatmapGridRef.current, newlyApplied, WORLD_WIDTH, WORLD_HEIGHT);
          redrawHeatmap();
        }
      }
      setLiveTailCursor(lastSeq);
    });
  }, [liveTail, replayDone, scheduleRedraw, redrawHeatmap]);

  const lastCursorWorldRef = useRef<Point>({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });
  const lastActivityAtRef = useRef(Date.now());
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
    let timeoutId: ReturnType<typeof setTimeout>;
    const send = () => {
      const myTrail = laserTrailsRef.current.find((t) => !t.id.startsWith("remote-"));
      heartbeat({
        clientId,
        username,
        cursorX: lastCursorWorldRef.current.x,
        cursorY: lastCursorWorldRef.current.y,
        laserTrail: myTrail ? myTrail.points : undefined,
      }).catch(() => {});
      const idleFor = Date.now() - lastActivityAtRef.current;
      const nextDelay =
        idleFor > HEARTBEAT_IDLE_THRESHOLD_MS ? HEARTBEAT_IDLE_INTERVAL_MS : HEARTBEAT_ACTIVE_INTERVAL_MS;
      timeoutId = setTimeout(send, nextDelay);
    };
    send();
    return () => clearTimeout(timeoutId);
  }, [heartbeat, clientId, username]);

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
        const convexMessage = err instanceof ConvexError && typeof err.data === "string" ? err.data : "";
        const isProtectedZone = convexMessage.startsWith("PROTECTED_ZONE:");
        const isRateLimited = err instanceof ConvexError && !isProtectedZone;
        if (isRateLimited) {
          rateLimitTracker.recordRateLimitError();
        }
        captureOperationalError(err, "stroke_submit", { mode: chunk.mode });
        pendingRef.current.delete(chunk.clientStrokeId);
        setSubmitError(
          isProtectedZone
            ? convexMessage.replace(/^PROTECTED_ZONE:\s*/, "")
            : isRateLimited
              ? "drawing too fast — pace yourself a sec"
              : "a mark didn't stick — try again",
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
              adminPasscode,
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

  // Admin deletes are soft-deletes under the hood (see the schema comment
  // on strokes.deleted) — the server patches a fresh sequence number onto
  // the row instead of removing it, which flows through everyone's normal
  // live-tail sync (including this admin's own client) as a tombstone to
  // apply, same as any other new event. No manual local cache surgery
  // needed here anymore; just page through the mutation until done.
  const handlePurgeAllStampedImages = useCallback(async () => {
    let cursor: string | null | undefined;
    let done = false;
    while (!done) {
      const res = await rollbackClient({
        passcode: adminPasscode,
        targetClientId: "ADMIN_IMAGE_STAMPER",
        cursor: cursor ?? undefined,
      });
      cursor = res.nextCursor;
      done = res.done;
    }
    setImagePlacement(null);
  }, [rollbackClient, adminPasscode]);

  const handleWipeArea = useCallback(
    async (rect: WorldRect) => {
      let totalDeleted = 0;
      let afterSequence: number | undefined;
      let done = false;
      while (!done) {
        const res = await wipeAreaMutation({
          passcode: adminPasscode,
          minX: rect.minX,
          minY: rect.minY,
          maxX: rect.maxX,
          maxY: rect.maxY,
          afterSequence,
        });
        totalDeleted += res.deletedCount;
        afterSequence = res.nextAfterSequence;
        done = res.done;
      }
      return totalDeleted;
    },
    [wipeAreaMutation, adminPasscode],
  );

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
        username,
        countryCode,
        commitOwnChunk,
      );
      buffer.addPoint(worldPoint);
      drawBufferRef.current = buffer;
      lastDrawWorldRef.current = worldPoint;
    },
    [commitOwnChunk, clientId, tool, brushType, color, brushWidth, opacity, username, countryCode],
  );

  const continueDraw = useCallback((worldPoint: Point) => {
    const buffer = drawBufferRef.current;
    const prev = lastDrawWorldRef.current;
    if (!buffer || !prev) return;

    const ctx = ctxRef.current;
    const { width, height } = viewportRef.current;
    if (ctx) {
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

      if (e.key === "Escape") {
        setTool("laser");
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
      })
        .then(() => {
          setCommentText("");
          setCommentInputPos(null);
        })
        .catch((err) => {
          setSubmitError(
            err instanceof ConvexError ? String(err.data) : "comment didn't post — try again",
          );
        });
    },
    [commentText, commentInputPos, clientId, username, countryCode, createComment],
  );

  const handleDeleteComment = useCallback(
    (id: string) => {
      removeComment({ commentId: id as Id<"canvasComments">, clientId }).catch(() => {});
    },
    [clientId, removeComment],
  );

  const handleAdminDeleteComment = useCallback(
    (id: string) => {
      if (!adminPasscode) return;
      adminRemoveComment({ commentId: id as Id<"canvasComments">, passcode: adminPasscode }).catch(() => {});
    },
    [adminPasscode, adminRemoveComment],
  );

  const handleReportComment = useCallback(
    (id: string) => {
      reportContent({
        reporterId: clientId,
        targetType: "comment",
        commentId: id as Id<"canvasComments">,
      }).catch(() => {});
    },
    [clientId, reportContent],
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
      if (isReplayMode && tool !== "pan" && tool !== "magnifier" && tool !== "ruler" && tool !== "region" && tool !== "coordFinder") return;

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
        setTool("laser");
        return;
      }

      const worldPt = getPointerWorld(e.clientX, e.clientY);
      Object.assign(lastCursorWorldRef.current, worldPt);
      lastActivityAtRef.current = Date.now();

      if (tool === "text") {
        const screenPt = getScreenPoint(e.clientX, e.clientY);
        setTextInputPos({ world: worldPt, screen: screenPt });
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

      if (tool === "reportRegion") {
        reportRegionDragRef.current = { start: worldPt, current: worldPt };
        return;
      }

      if (tool === "adminWipeRegion") {
        adminWipeRegionDragRef.current = { start: worldPt, current: worldPt };
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

      if (tool === "coordFinder") {
        coordFinderDragRef.current = {
          startWorld: worldPt,
          currentWorld: worldPt,
        };
        updateCoordFinder();
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
      lastActivityAtRef.current = Date.now();
      // No dirty flags — just runs the per-frame overlay position sync (see
      // scheduleRedraw) so the protected-zone hover badge tracks the cursor
      // even on a plain idle hover, which none of the tool branches below
      // otherwise trigger a redraw for.
      scheduleRedraw({});

      // Attribution tooltip: only while genuinely hovering (mouse, no button
      // held) — a stencil/shape/ruler drag or an active brush stroke has its
      // own meaning for pointer movement and shouldn't also flip a tooltip
      // in and out under the cursor. Looked up via strokesByTileRef (a real
      // tile-bucketed index kept in sync with committedRef, not a linear
      // scan filtered by tile) so this stays cheap regardless of how many
      // strokes the wall has.
      if (e.pointerType === "mouse" && e.buttons === 0) {
        const { tileX, tileY } = getTileCoords(worldPt.x, worldPt.y, TILE_SIZE);
        const cursorTileId = getTileId(tileX, tileY);
        const candidates = strokesByTileRef.current.get(cursorTileId) ?? [];
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

      if (tool === "reportRegion") {
        const drag = reportRegionDragRef.current;
        if (!drag) return;
        drag.current = worldPt;
        scheduleRedraw({ strokes: true });
        return;
      }

      if (tool === "adminWipeRegion") {
        const drag = adminWipeRegionDragRef.current;
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

      if (tool === "coordFinder") {
        lastCoordFinderPointerRef.current = { world: worldPt, screen: screenPt };
        if (e.buttons === 1 && coordFinderDragRef.current) {
          coordFinderDragRef.current.currentWorld = worldPt;
        }
        updateCoordFinder();
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
        setTool("laser");
        scheduleRedraw({ strokes: true });
      }

      if (tool === "reportRegion") {
        const drag = reportRegionDragRef.current;
        reportRegionDragRef.current = null;
        if (drag && distance(drag.start, drag.current) >= MIN_REGION_DRAG) {
          setPendingReportRegion(normalizeRect(drag.start, drag.current));
        }
        setTool("laser");
        scheduleRedraw({ strokes: true });
      }

      if (tool === "adminWipeRegion") {
        const drag = adminWipeRegionDragRef.current;
        adminWipeRegionDragRef.current = null;
        if (drag && distance(drag.start, drag.current) >= MIN_REGION_DRAG) {
          setPendingWipeRegion(normalizeRect(drag.start, drag.current));
          setAdminOpen(true);
        }
        setTool("laser");
        scheduleRedraw({ strokes: true });
      }

      if (tool === "ruler") {
        rulerDragRef.current = null;
        updateRuler();
      }

      if (tool === "coordFinder") {
        updateCoordFinder();
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

  // Admin-only: jump to and highlight a reported rectangle. The highlight
  // is local to this admin's own screen and clears itself — never synced,
  // never shown to other users.
  const handleTeleportToReportedRegion = useCallback((rect: WorldRect) => {
    const fitted = fitCameraToRegion(rect, viewportRef.current.width, viewportRef.current.height);
    cameraRef.current = fitted;
    setCameraSnapshot(fitted);
    setHighlightedReportRegion(rect);
    scheduleRedraw({ world: true, strokes: true });
    setTimeout(() => setHighlightedReportRegion(null), 6000);
  }, [scheduleRedraw]);

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
                    : tool === "shape" || tool === "ruler" || tool === "laser" || tool === "stencil" || tool === "eyedropper" || tool === "comment" || tool === "region" || tool === "reportRegion" || tool === "adminWipeRegion" || tool === "coordFinder"
                      ? "cursor-crosshair"
                      : tool === "brush" || tool === "eraser"
                        ? "cursor-none"
                        : "cursor-default"
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
          <CoordFinderOverlay ref={coordFinderElRef} />
        </div>

        <RemoteCursors
          ref={remoteCursorsRef}
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

        {/* Desktop Sidebar (>= 1360px) — every control that used to live in
            the header row, stacked vertically and docked directly under the
            mini-map instead. Same breakpoint the header row used to switch
            on, so this and the mobile hamburger drawer are still mutually
            exclusive. Collapsible down to an icon-only rail — each icon just
            expands the full sidebar back out rather than trying to open its
            control's own dropdown directly from the collapsed state, since
            that would mean duplicating every control's open/close logic. */}
        {sidebarCollapsed ? (
          <div
            aria-label="Canvas Tools & Controls (collapsed)"
            className="pointer-events-auto hidden min-[1360px]:flex flex-col items-center gap-1.5 overflow-y-auto rounded-sm border-2 border-chrome-border bg-chrome-bg/95 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm absolute right-3 sm:right-4 z-20"
            style={{ top: sidebarTop, maxHeight: `calc(100vh - ${sidebarTop}px - 12px)` }}
          >
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="mb-1 flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised text-ink-dim hover:text-ink"
            >
              ◂
            </button>

            <GridToggle config={gridConfig} onChange={setGridConfig} locale={locale} iconOnly />
            <HideCommentsToggle showComments={showComments} onToggle={toggleShowComments} locale={locale} iconOnly />

            <button
              type="button"
              onClick={() => zoomButton(1 / 1.2)}
              aria-label="zoom out"
              title="Zoom Out"
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised font-mono text-sm font-bold text-ink hover:border-rust hover:text-accent-yellow"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => zoomButton(1.2)}
              aria-label="zoom in"
              title="Zoom In"
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised font-mono text-sm font-bold text-ink hover:border-rust hover:text-accent-yellow"
            >
              +
            </button>
            <button
              type="button"
              onClick={resetView}
              aria-label="reset view"
              title={t(locale, "reset_view")}
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised font-mono text-sm font-bold text-ink hover:border-rust hover:text-accent-yellow"
            >
              ↺
            </button>

            <HeatmapToggle showHeatmap={showHeatmap} onToggle={handleToggleHeatmap} locale={locale} iconOnly />
            <ShareButton onShare={handleShare} locale={locale} iconOnly />

            <div className="my-0.5 h-px w-6 bg-chrome-border/60" />

            <SpatialCompass camera={cameraSnapshot} onTeleport={handleJumpToPoint} locale={locale} iconOnly />
            <ExploreMenu
              onJumpToPoint={handleJumpToPoint}
              getBusiestPoint={getBusiestPoint}
              getRandomActivePoint={getRandomActivePoint}
              getLatestActivityPoint={getLatestActivityPoint}
              onlineCount={onlineCount ?? 1}
              locale={locale}
              iconOnly
            />
            <BookmarkMenu
              currentCamera={cameraSnapshot}
              clientId={clientId}
              onTeleport={handleBookmarkTeleport}
              locale={locale}
              iconOnly
            />
            <CommunityGalleryModal
              clientId={clientId}
              username={username}
              onTeleport={handleBookmarkTeleport}
              locale={locale}
              iconOnly
            />
            <ReportButton
              currentCamera={cameraSnapshot}
              clientId={clientId}
              locale={locale}
              iconOnly
              pendingRegion={pendingReportRegion}
              onStartRegionSelect={() => setTool('reportRegion')}
              onRegionConsumed={() => setPendingReportRegion(null)}
            />

            <div className="my-0.5 h-px w-6 bg-chrome-border/60" />

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
              iconOnly
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
              iconOnly
            />
          </div>
        ) : (
        <aside
          id="desktop-sidebar"
          aria-label="Canvas Tools & Controls"
          className="pointer-events-auto hidden min-[1360px]:flex w-[196px] flex-col gap-3 overflow-y-auto rounded-sm border-2 border-chrome-border bg-chrome-bg/95 p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm absolute right-3 sm:right-4 z-20"
          style={{ top: sidebarTop, maxHeight: `calc(100vh - ${sidebarTop}px - 12px)` }}
        >
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="flex h-5 w-5 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised text-ink-dim hover:text-ink"
            >
              ▸
            </button>
          </div>
          <div className="flex flex-col items-start gap-2 w-full">
            <MobileGroupLabel>🌐 {t(locale, "group_view_display")}</MobileGroupLabel>
            <GridToggle config={gridConfig} onChange={setGridConfig} locale={locale} />
            <HideCommentsToggle showComments={showComments} onToggle={toggleShowComments} locale={locale} />

            {/* Line 1: -, 10%, + */}
            <div className="w-full pt-1">
              <ZoomPill
                zoomPercent={zoomPercent}
                onZoomIn={() => zoomButton(1.2)}
                onZoomOut={() => zoomButton(1 / 1.2)}
              />
            </div>

            {/* Line 2: reset, heatmap, share (icons only) */}
            <div className="grid grid-cols-3 gap-1.5 w-full">
              <button
                type="button"
                onClick={resetView}
                aria-label="reset view"
                title={t(locale, "reset_view")}
                className="flex h-[28px] w-full items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised/90 font-mono text-sm font-bold text-ink shadow-sm transition-colors hover:border-rust hover:text-accent-yellow"
              >
                ↺
              </button>
              <HeatmapToggle showHeatmap={showHeatmap} onToggle={handleToggleHeatmap} locale={locale} iconOnly />
              <ShareButton onShare={handleShare} locale={locale} iconOnly />
            </div>
          </div>

          <div className="border-t border-chrome-border/60" />

          <div className="flex flex-col items-start gap-2 w-full">
            <MobileGroupLabel>🧭 {t(locale, "group_spatial_nav")}</MobileGroupLabel>
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
            <ReportButton
              currentCamera={cameraSnapshot}
              clientId={clientId}
              locale={locale}
              pendingRegion={pendingReportRegion}
              onStartRegionSelect={() => setTool('reportRegion')}
              onRegionConsumed={() => setPendingReportRegion(null)}
            />
          </div>

          <div className="border-t border-chrome-border/60" />

          <div className="flex flex-col items-start gap-2 w-full">
            <MobileGroupLabel>🎥 {t(locale, "group_timeline_export")}</MobileGroupLabel>
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

        </aside>
        )}

        <ProtectedZonesOverlay
          ref={protectedZonesOverlayRef}
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

        {/* Right Section: Preferences & Status Controls (>= 1360px only —
            the mobile drawer below has its own copies of these same
            controls, so this must stay desktop-only to avoid duplicating
            them and overflowing narrow headers). */}
        <div className="hidden min-[1360px]:flex items-center gap-1.5 sm:gap-2 pr-1 sm:pr-4">
          <UsernameControl username={username} onUsernameChange={handleUsernameChange} locale={locale} />
          <LanguagePicker
            currentLocale={locale}
            onLocaleChange={(loc) => {
              setLocale(loc);
              localStorage.setItem("alwaysdraw_locale", loc);
            }}
          />
          <ThemeToggle />
          <HotkeysModal isOpen={hotkeysOpen} onToggle={() => setHotkeysOpen((v) => !v)} locale={locale} />
          <HelpModal locale={locale} />
          <ConnectionStatus locale={locale} />
        </div>

        {/* Mobile Hamburger Button (< 1360px) — the desktop sidebar is
            `min-[1360px]:flex`-only, so below that width this is the only
            way to reach Grid/Bookmarks/Explore/Gallery/Time Travel/Export
            etc. at all. */}
        <div className="min-[1360px]:hidden pr-1">
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
          <div className="min-[1360px]:hidden absolute right-0 top-full z-[1000] mt-2 w-max max-w-[calc(100vw-1.5rem)] rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-md">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-chrome-border/60 pb-1.5 font-mono text-[11px] font-bold text-ink-dim uppercase">
              <span className="whitespace-nowrap">🛠️ {t(locale, "canvas_tools_panels")}</span>
              <span className="whitespace-nowrap text-accent-yellow">{t(locale, "tiles")}: {visibleTileCount || 1}/1600</span>
            </div>

            <MobileGroupLabel>🌐 {t(locale, "group_view_display")}</MobileGroupLabel>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <ZoomPill
                zoomPercent={zoomPercent}
                onZoomIn={() => zoomButton(1.2)}
                onZoomOut={() => zoomButton(1 / 1.2)}
              />
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
              <HideCommentsToggle showComments={showComments} onToggle={toggleShowComments} locale={locale} />
              <HeatmapToggle showHeatmap={showHeatmap} onToggle={handleToggleHeatmap} locale={locale} />
              <ShareButton onShare={handleShare} locale={locale} />
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
              <ReportButton
              currentCamera={cameraSnapshot}
              clientId={clientId}
              locale={locale}
              pendingRegion={pendingReportRegion}
              onStartRegionSelect={() => setTool('reportRegion')}
              onRegionConsumed={() => setPendingReportRegion(null)}
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
              <HelpModal locale={locale} />
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

      {tool === "reportRegion" && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-sm border border-accent-crimson bg-chrome-bg/95 px-3 py-1.5 font-mono text-xs font-bold text-accent-crimson shadow-[0_4px_16px_rgba(0,0,0,0.85)] backdrop-blur-md">
          🚩 {t(locale, "report_region_select_hint")}
        </div>
      )}

      {tool === "adminWipeRegion" && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-sm border-2 border-accent-crimson bg-chrome-bg/95 px-3 py-1.5 font-mono text-xs font-bold text-accent-crimson shadow-[0_4px_16px_rgba(0,0,0,0.85)] backdrop-blur-md">
          ⚠️ Drag on the canvas to mark the area to purge
        </div>
      )}

      <CommentsOverlay
        ref={commentsOverlayRef}
        comments={showComments ? comments : []}
        camera={cameraSnapshot}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        locale={locale}
        onDeleteComment={handleDeleteComment}
        onReportComment={handleReportComment}
        onAdminDeleteComment={handleAdminDeleteComment}
        isAdmin={Boolean(adminPasscode)}
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
          onTeleport={(x, y, zoom) => handleBookmarkTeleport({ x, y }, zoom, "Reported Area")}
          onTeleportToRegion={handleTeleportToReportedRegion}
          pendingWipeRegion={pendingWipeRegion}
          onStartWipeRegionSelect={() => {
            setAdminOpen(false);
            setTool("adminWipeRegion");
          }}
          onWipeRegionConsumed={() => setPendingWipeRegion(null)}
          onWipeArea={handleWipeArea}
        />
      </nav>

      {textInputPos && (
        <div
          className="fixed z-[1000] rounded-sm border-2 border-rust bg-chrome-bg/95 p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-md w-[320px] flex flex-col gap-2.5"
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
