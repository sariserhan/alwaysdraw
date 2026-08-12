"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { WorldRect } from "@/lib/types";
import { ChromeRivet } from "./ChromeRivet";
import { POPULAR_COUNTRIES } from "@/lib/flags";

export interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  authenticated: boolean;
  passcode: string;
  onAuthenticate: (passcode: string) => Promise<boolean>;
  onStartImagePlacement: (file: File, url: string, aspectRatio: number) => void;
  onPurgeAllStampedImages: () => Promise<void>;
  onTeleport?: (x: number, y: number, zoom: number) => void;
  onTeleportToRegion?: (rect: WorldRect) => void;
  /** Marked via drag-select on the canvas (see GlobalCanvas's
   * adminWipeRegion tool) — set once the admin finishes dragging. */
  pendingWipeRegion: WorldRect | null;
  /** Closes this modal and switches the canvas into drag-to-mark mode. */
  onStartWipeRegionSelect: () => void;
  /** Called after a purge completes or the marked area is cleared. */
  onWipeRegionConsumed: () => void;
  /** Spawn a live human-simulated AI artist agent at target zone coordinates */
  onSpawnAiAgent?: (
    name: string,
    prompt: string,
    x: number,
    y: number,
    brushType: any,
    color: string,
    countryCode?: string,
    imageElement?: HTMLImageElement | null
  ) => void;
  /** Launch an active community drawing goal worldwide */
  onLaunchGoal?: (prompt: string, targetX?: number, targetY?: number) => void;
  onClearGoal?: () => void;
  /** Owned by GlobalCanvas (not this modal) so it can also drop the purged
   * strokes from the local committed-strokes cache and redraw immediately —
   * otherwise the admin who just purged an area wouldn't see it reflected
   * until a hard refresh, since the canvas only syncs new strokes in, never
   * deletions. Pages through the whole marked area internally; resolves
   * with the total number of strokes deleted. */
  onWipeArea: (rect: WorldRect) => Promise<number>;
}

export function AdminPanelModal({
  isOpen,
  onClose,
  authenticated,
  passcode: activePasscode,
  onAuthenticate,
  onStartImagePlacement,
  onPurgeAllStampedImages,
  onTeleport,
  onTeleportToRegion,
  pendingWipeRegion,
  onStartWipeRegionSelect,
  onWipeRegionConsumed,
  onSpawnAiAgent,
  onLaunchGoal,
  onClearGoal,
  onWipeArea,
}: AdminPanelModalProps) {
  const [inputPasscode, setInputPasscode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"moderation" | "zones" | "broadcast" | "image" | "reports" | "telemetry" | "ai_agent">("moderation");

  // Moderation state
  const [isWiping, setIsWiping] = useState(false);
  const [targetClientId, setTargetClientId] = useState("");
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Drawing Goal state
  const [goalPrompt, setGoalPrompt] = useState("Draw an 8-bit retro gaming character near Origin Plaza!");
  const [goalTargetX, setGoalTargetX] = useState(0);
  const [goalTargetY, setGoalTargetY] = useState(0);

  // AI Agent state
  const [aiArtistName, setAiArtistName] = useState("ArtistAlex");
  const [aiPrompt, setAiPrompt] = useState("castle");
  const [aiCountry, setAiCountry] = useState("US");
  const [aiZoneX, setAiZoneX] = useState(0);
  const [aiZoneY, setAiZoneY] = useState(0);
  const [aiBrush, setAiBrush] = useState("neonGlow");
  const [aiColor, setAiColor] = useState("#d94626");
  const [aiImageElement, setAiImageElement] = useState<HTMLImageElement | null>(null);
  const [aiEngineStatus, setAiEngineStatus] = useState<string>("Checking AI status...");
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/ai-draw")
      .then((res) => res.json())
      .then((data) => {
        setAiEngineStatus(data.statusMessage || "Active");
        setHasGeminiKey(Boolean(data.hasApiKey));
      })
      .catch(() => {
        setAiEngineStatus("🟡 Procedural Engine Active");
        setHasGeminiKey(false);
      });
  }, []);

  // Protected Zone state
  const [zoneName, setZoneName] = useState("Community Mural Shield");
  const [zoneMinX, setZoneMinX] = useState(9000);
  const [zoneMinY, setZoneMinY] = useState(9000);
  const [zoneMaxX, setZoneMaxX] = useState(11000);
  const [zoneMaxY, setZoneMaxY] = useState(11000);
  const [zoneOwnerClientId, setZoneOwnerClientId] = useState("");
  const [zoneOwnerName, setZoneOwnerName] = useState("");

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);

  // Mutations & Queries
  const rollbackClient = useMutation(api.admin.rollbackClient);
  const publishBroadcast = useMutation(api.admin.publishBroadcast);
  const clearBroadcast = useMutation(api.admin.clearBroadcast);
  const createProtectedZone = useMutation(api.admin.createProtectedZone);
  const deleteProtectedZone = useMutation(api.admin.deleteProtectedZone);
  const updateReportStatus = useMutation(api.reports.updateStatus);
  const adminRemoveComment = useMutation(api.comments.adminRemove);

  const protectedZones = useQuery(
    api.admin.getProtectedZones,
    authenticated ? { passcode: activePasscode } : "skip",
  );
  const telemetry = useQuery(
    api.admin.getTelemetry,
    authenticated ? { passcode: activePasscode } : "skip",
  );
  const openReports = useQuery(
    api.reports.listOpen,
    authenticated ? { passcode: activePasscode } : "skip",
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: this is a non-modal-positioned <aside> (not the only
      // thing on screen — the canvas stays interactive behind it), so the
      // browser won't do this for us the way a native <dialog> would.
      // Without it, Tab from the last field walks focus out onto canvas
      // tools a keyboard user can no longer see they've left the panel for.
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    // Initial focus: the passcode field pre-auth (the one thing a keyboard
    // user actually needs to reach first), otherwise the panel itself so
    // Tab from here enters the panel's own controls rather than leaving
    // focus stranded wherever it was on the page behind it.
    const target = authenticated
      ? modalRef.current
      : (modalRef.current.querySelector<HTMLElement>("#admin-passcode") ?? modalRef.current);
    target.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, authenticated]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPasscode.trim()) return;
    try {
      const success = await onAuthenticate(inputPasscode);
      if (success) {
        setAuthError(null);
        setInputPasscode("");
      } else {
        setAuthError("Invalid admin passcode. Access denied.");
      }
    } catch {
      setAuthError("Failed to verify passcode.");
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    const aspectRatio = (img.width || 1) / (img.height || 1);
    onStartImagePlacement(file, url, aspectRatio);
    onClose();
  };

  const handleWipeArea = async () => {
    if (!pendingWipeRegion || isWiping) return;
    try {
      setIsWiping(true);
      setActionStatus("Purging marked area...");
      const totalDeleted = await onWipeArea(pendingWipeRegion);
      setActionStatus(`Success! Purged ${totalDeleted} strokes from the marked area.`);
      onWipeRegionConsumed();
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Wipe failed"}`);
    } finally {
      setIsWiping(false);
    }
  };

  const handleRollbackClient = async () => {
    if (!targetClientId.trim()) return;
    try {
      let totalDeleted = 0;
      let cursor: string | null | undefined;
      let done = false;
      while (!done) {
        setActionStatus(`Rolling back Client ID: ${targetClientId}... ${totalDeleted} strokes so far.`);
        const res = await rollbackClient({
          passcode: activePasscode,
          targetClientId,
          cursor: cursor ?? undefined,
        });
        totalDeleted += res.deletedCount;
        cursor = res.nextCursor;
        done = res.done;
      }
      setActionStatus(`Success! Purged ${totalDeleted} strokes drawn by ${targetClientId}.`);
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Rollback failed"}`);
    }
  };

  const handleCreateZone = async () => {
    if (!zoneName.trim()) return;
    try {
      setActionStatus(`Creating Protection Zone: ${zoneName}...`);
      await createProtectedZone({
        passcode: activePasscode,
        name: zoneName,
        minX: Number(zoneMinX),
        minY: Number(zoneMinY),
        maxX: Number(zoneMaxX),
        maxY: Number(zoneMaxY),
        ownerClientId: zoneOwnerClientId.trim() || undefined,
        ownerName: zoneOwnerName.trim() || undefined,
      });
      setActionStatus(`Success! Locked canvas zone "${zoneName}".`);
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Zone creation failed"}`);
    }
  };

  const handleDeleteZone = async (zoneId: Id<"protectedZones">) => {
    try {
      setActionStatus("Removing protection zone...");
      await deleteProtectedZone({
        passcode: activePasscode,
        zoneId,
      });
      setActionStatus("Success! Unlocked canvas zone.");
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Zone delete failed"}`);
    }
  };

  const handlePurgeImages = async () => {
    try {
      setActionStatus("Deleting all stamped images from canvas...");
      await onPurgeAllStampedImages();
      setActionStatus("Success! All stamped images deleted from canvas.");
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Purge failed"}`);
    }
  };

  const handlePublishBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    try {
      setActionStatus("Publishing broadcast announcement...");
      await publishBroadcast({
        passcode: activePasscode,
        message: broadcastMessage,
      });
      setActionStatus("Success! Live broadcast sent to all active painters.");
      setBroadcastMessage("");
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Broadcast failed"}`);
    }
  };

  const handleClearBroadcast = async () => {
    try {
      setActionStatus("Clearing broadcast banner...");
      await clearBroadcast({ passcode: activePasscode });
      setActionStatus("Success! Broadcast cleared.");
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Clear failed"}`);
    }
  };

  const handleDismissReport = async (reportId: Id<"contentReports">) => {
    try {
      await updateReportStatus({ passcode: activePasscode, reportId, status: "dismissed" });
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Dismiss failed"}`);
    }
  };

  const handleTeleportToReport = (x: number, y: number, zoom: number) => {
    onTeleport?.(x, y, zoom);
    onClose();
  };

  const handleTeleportToReportRegion = (rect: WorldRect) => {
    onTeleportToRegion?.(rect);
    onClose();
  };

  const handleDeleteReportedComment = async (
    reportId: Id<"contentReports">,
    commentId: Id<"canvasComments">,
  ) => {
    try {
      await adminRemoveComment({ passcode: activePasscode, commentId });
      await updateReportStatus({ passcode: activePasscode, reportId, status: "reviewed" });
      setActionStatus("Success! Comment removed.");
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Delete failed"}`);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Admin Control Center"
      tabIndex={-1}
      className="pointer-events-auto fixed left-4 top-28 bottom-20 z-40 flex w-96 sm:w-[440px] max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-sm border-2 border-rust bg-chrome-bg/95 p-4 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.85)] backdrop-blur-md"
    >
      <ChromeRivet className="top-2 left-2" />
      <ChromeRivet className="top-2 right-2" />

      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-chrome-border/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <div>
            <h2 className="font-mono text-sm font-bold uppercase text-accent-crimson">
              Admin Control Center
            </h2>
            <p className="font-mono text-[10px] text-ink-dim">
              Canvas moderation, protection zones &amp; telemetry
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised font-mono text-xs font-bold text-ink transition hover:border-rust hover:text-accent-crimson"
        >
          ✕
        </button>
      </div>

      {/* Auth Gate */}
      {!authenticated ? (
        <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3 py-4">
          <div className="flex flex-col gap-1.5 text-left font-mono">
            <label htmlFor="admin-passcode" className="text-xs font-bold text-ink">
              Enter Admin Passcode:
            </label>
            <input
              id="admin-passcode"
              type="password"
              value={inputPasscode}
              onChange={(e) => setInputPasscode(e.target.value)}
              placeholder="Passcode..."
              className="rounded border border-chrome-border bg-chrome-bg-raised px-3 py-1.5 font-mono text-xs text-ink placeholder:text-ink-dim focus:border-rust focus:outline-none"
            />
          </div>
          {authError && <p className="font-mono text-xs text-accent-crimson">{authError}</p>}
          <button
            type="submit"
            className="rounded border border-rust bg-rust px-4 py-1.5 font-mono text-xs font-bold text-on-accent transition hover:brightness-110"
          >
            Authenticate
          </button>
        </form>
      ) : (
        <>
          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1 border-b border-chrome-border/60 pb-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab("moderation")}
              className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 font-bold transition-colors ${
                activeTab === "moderation"
                  ? "border-rust bg-rust/30 text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised/60 text-ink-dim hover:border-rust/60 hover:text-ink"
              }`}
            >
              <span>🧹</span>
              <span>MOD</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("zones")}
              className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 font-bold transition-colors ${
                activeTab === "zones"
                  ? "border-rust bg-rust/30 text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised/60 text-ink-dim hover:border-rust/60 hover:text-ink"
              }`}
            >
              <span>🛡️</span>
              <span>ZONES</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("image")}
              className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 font-bold transition-colors ${
                activeTab === "image"
                  ? "border-rust bg-rust/30 text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised/60 text-ink-dim hover:border-rust/60 hover:text-ink"
              }`}
            >
              <span>🖼️</span>
              <span>UPLOAD</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("broadcast")}
              className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 font-bold transition-colors ${
                activeTab === "broadcast"
                  ? "border-rust bg-rust/30 text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised/60 text-ink-dim hover:border-rust/60 hover:text-ink"
              }`}
            >
              <span>📢</span>
              <span>BANNER</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reports")}
              className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 font-bold transition-colors ${
                activeTab === "reports"
                  ? "border-rust bg-rust/30 text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised/60 text-ink-dim hover:border-rust/60 hover:text-ink"
              }`}
            >
              <span>🚩</span>
              <span className="truncate">REPORTS{openReports && openReports.length > 0 ? ` (${openReports.length})` : ""}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("telemetry")}
              className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 font-bold transition-colors ${
                activeTab === "telemetry"
                  ? "border-rust bg-rust/30 text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised/60 text-ink-dim hover:border-rust/60 hover:text-ink"
              }`}
            >
              <span>📊</span>
              <span>STATS</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai_agent")}
              className={`col-span-3 flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1.5 font-bold transition-colors ${
                activeTab === "ai_agent"
                  ? "border-rust bg-rust/30 text-accent-yellow"
                  : "border-chrome-border bg-chrome-bg-raised/60 text-ink-dim hover:border-rust/60 hover:text-ink"
              }`}
            >
              <span>🤖</span>
              <span>SPAWN LIVE AI ARTIST AGENT</span>
            </button>
          </div>

          {/* Status Alert Banner */}
          {actionStatus && (
            <div className="rounded border border-rust/60 bg-rust/20 p-2 font-mono text-xs font-bold text-accent-yellow">
              {actionStatus}
            </div>
          )}

          {/* TAB 1: Moderation */}
          {activeTab === "moderation" && (
            <div className="flex flex-col gap-4 text-left font-mono text-xs">
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-crimson uppercase">🧹 Area Wipe</span>
                {pendingWipeRegion ? (
                  <>
                    <p className="rounded border border-accent-crimson/60 bg-accent-crimson/10 p-2 text-[11px] text-ink">
                      ⚠️ Marked area: ({Math.round(pendingWipeRegion.minX)}, {Math.round(pendingWipeRegion.minY)}) → ({Math.round(pendingWipeRegion.maxX)}, {Math.round(pendingWipeRegion.maxY)})
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleWipeArea}
                        disabled={isWiping}
                        className="flex-1 rounded bg-accent-crimson px-3 py-1.5 font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
                      >
                        {isWiping ? "PURGING..." : "⚠️ CONFIRM PURGE"}
                      </button>
                      <button
                        type="button"
                        onClick={onWipeRegionConsumed}
                        disabled={isWiping}
                        className="rounded border border-chrome-border bg-chrome-bg px-3 py-1.5 font-bold text-ink-dim hover:text-ink disabled:opacity-50"
                      >
                        CLEAR
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onStartWipeRegionSelect}
                    className="rounded border border-accent-crimson bg-accent-crimson/20 px-3 py-1.5 font-bold text-accent-crimson hover:bg-accent-crimson hover:text-on-accent"
                  >
                    ⬚ MARK AREA TO PURGE
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">🚫 Rollback Client ID</span>
                <input
                  type="text"
                  value={targetClientId}
                  onChange={(e) => setTargetClientId(e.target.value)}
                  placeholder="Enter target clientId string..."
                  className="w-full rounded border border-chrome-border bg-chrome-bg px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={handleRollbackClient}
                  className="rounded bg-rust px-3 py-1.5 font-bold text-on-accent hover:brightness-110"
                >
                  PURGE ALL CLIENT MARKS
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Protected Zones */}
          {activeTab === "zones" && (
            <div className="flex flex-col gap-4 text-left font-mono text-xs">
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">🛡️ Lock Canvas Area (Mural Shield)</span>
                <p className="text-[10px] text-ink-dim">
                  Prevent non-admin painters from drawing over community murals inside this bounding box.
                </p>
                <div>
                  <label className="block text-[10px] text-ink-dim font-bold">Zone Name</label>
                  <input
                    type="text"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder="e.g. Central Community Mural"
                    className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-dim">Min X</label>
                    <input
                      type="number"
                      value={zoneMinX}
                      onChange={(e) => setZoneMinX(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim">Min Y</label>
                    <input
                      type="number"
                      value={zoneMinY}
                      onChange={(e) => setZoneMinY(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim">Max X</label>
                    <input
                      type="number"
                      value={zoneMaxX}
                      onChange={(e) => setZoneMaxX(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim">Max Y</label>
                    <input
                      type="number"
                      value={zoneMaxY}
                      onChange={(e) => setZoneMaxY(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-ink-dim font-bold">
                    Assign to Client ID (optional — future: user_id)
                  </label>
                  <input
                    type="text"
                    value={zoneOwnerClientId}
                    onChange={(e) => setZoneOwnerClientId(e.target.value)}
                    placeholder="clientId this zone belongs to — leave blank for admin-only"
                    className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-ink-dim font-bold">Owner Display Name (optional)</label>
                  <input
                    type="text"
                    value={zoneOwnerName}
                    onChange={(e) => setZoneOwnerName(e.target.value)}
                    placeholder="shown on hover, e.g. PixelWizard99"
                    className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateZone}
                  className="mt-1 rounded bg-rust px-3 py-1.5 font-bold text-on-accent hover:brightness-110"
                >
                  LOCK CANVAS ZONE
                </button>
              </div>

              {/* Active Zones List */}
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">🔒 Active Protection Locks</span>
                {protectedZones && protectedZones.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {protectedZones.map((z) => (
                      <div
                        key={z._id}
                        className="flex items-center justify-between rounded border border-chrome-border bg-chrome-bg p-2 text-[11px]"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-accent-yellow">{z.name}</span>
                          <span className="text-[9px] text-ink-dim">
                            ({Math.round(z.minX)}, {Math.round(z.minY)}) → ({Math.round(z.maxX)}, {Math.round(z.maxY)})
                          </span>
                          {(z.ownerName || z.ownerClientId) && (
                            <span className="text-[9px] text-accent-green">
                              owned by {z.ownerName || z.ownerClientId}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteZone(z._id)}
                          className="rounded border border-accent-crimson bg-accent-crimson/20 px-2 py-1 font-bold text-accent-crimson hover:bg-accent-crimson hover:text-on-accent"
                        >
                          UNLOCK
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-ink-dim">No active protected zones on the wall.</span>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Image Upload */}
          {activeTab === "image" && (
            <div className="flex flex-col gap-3 text-left font-mono text-xs">
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">🖼️ Interactive Image Placement</span>
                <p className="text-[10px] text-ink-dim">
                  Select an image to place directly on the canvas. Drag to move, pull corner handle to resize, then click Stamp!
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="block w-full text-xs text-ink file:mr-2 file:rounded file:border file:border-rust file:bg-rust file:px-2 file:py-1 file:text-xs file:font-bold file:text-on-accent hover:file:brightness-110"
                />
              </div>

              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-crimson uppercase">🗑️ Purge Stamped Images</span>
                <p className="text-[10px] text-ink-dim">
                  Remove all image stamps previously placed on the canvas by Admin.
                </p>
                <button
                  type="button"
                  onClick={handlePurgeImages}
                  className="rounded border border-accent-crimson bg-accent-crimson/20 px-3 py-1.5 font-bold text-accent-crimson hover:bg-accent-crimson hover:text-on-accent transition-all"
                >
                  DELETE ALL STAMPED IMAGES
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Broadcast */}
          {activeTab === "broadcast" && (
            <div className="flex flex-col gap-3 text-left font-mono text-xs">
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">📢 Live Announcement Ticker</span>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Type an announcement to broadcast to all online painters worldwide..."
                  className="w-full rounded border border-chrome-border bg-chrome-bg p-2 text-xs text-ink focus:border-rust focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePublishBroadcast}
                    className="flex-1 rounded bg-rust px-3 py-1.5 font-bold text-on-accent hover:brightness-110"
                  >
                    PUBLISH BROADCAST
                  </button>
                  <button
                    type="button"
                    onClick={handleClearBroadcast}
                    className="rounded border border-chrome-border bg-chrome-bg px-3 py-1.5 font-bold text-ink hover:text-accent-crimson"
                  >
                    CLEAR BANNER
                  </button>
                </div>
              </div>

              {/* ADMIN DRAWING GOAL DISPATCHER */}
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">🎯 Admin Drawing Goal Dispatcher</span>
                <p className="text-[10px] text-ink-dim leading-relaxed">
                  Launch a community drawing goal worldwide. Displays an interactive floating goal prompt card for all live canvas visitors.
                </p>

                <div>
                  <label className="block text-[10px] text-ink-dim font-bold">Goal Prompt Text</label>
                  <input
                    type="text"
                    value={goalPrompt}
                    onChange={(e) => setGoalPrompt(e.target.value)}
                    placeholder="e.g. Help finish this 8-bit space rocket!"
                    className="w-full rounded border border-chrome-border bg-chrome-bg px-2.5 py-1.5 text-xs text-ink focus:border-rust focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Target X</label>
                    <input
                      type="number"
                      value={goalTargetX}
                      onChange={(e) => setGoalTargetX(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Target Y</label>
                    <input
                      type="number"
                      value={goalTargetY}
                      onChange={(e) => setGoalTargetY(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!onLaunchGoal || !goalPrompt.trim()) return;
                      onLaunchGoal(goalPrompt, goalTargetX, goalTargetY);
                      setActionStatus(`Success! Launched Drawing Goal "${goalPrompt}" worldwide.`);
                    }}
                    className="flex-1 rounded bg-accent-crimson px-3 py-1.5 font-bold uppercase text-white hover:bg-accent-crimson-deep transition-all"
                  >
                    🎯 LAUNCH GOAL WORLDWIDE
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearGoal?.();
                      setActionStatus("Success! Cleared active drawing goal.");
                    }}
                    className="rounded border border-chrome-border bg-chrome-bg px-3 py-1.5 font-bold text-ink-dim hover:text-ink"
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Reports queue */}
          {activeTab === "reports" && (
            <div className="flex flex-col gap-2 text-left font-mono text-xs">
              {!openReports || openReports.length === 0 ? (
                <span className="text-[10px] text-ink-dim">No open reports.</span>
              ) : (
                openReports.map((r) => (
                  <div
                    key={r._id}
                    className="flex flex-col gap-1.5 rounded border border-chrome-border bg-chrome-bg-raised/70 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase text-accent-yellow">
                        {r.targetType === "area" ? "🗺️ Area" : "📝 Comment"}
                      </span>
                      <span className="text-[9px] text-ink-dim">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {r.targetType === "comment" && (
                      <p className="rounded bg-chrome-bg p-1.5 text-[11px] text-ink">
                        {r.commentText !== undefined
                          ? `"${r.commentText}" — ${r.commentAuthor ?? "anon"}`
                          : "(comment already deleted)"}
                      </p>
                    )}

                    {r.targetType === "area" &&
                      r.minX !== undefined && r.minY !== undefined && r.maxX !== undefined && r.maxY !== undefined && (
                        <p className="text-[10px] text-ink-dim">
                          🚩 Marked area: ({Math.round(r.minX)}, {Math.round(r.minY)}) → ({Math.round(r.maxX)}, {Math.round(r.maxY)})
                        </p>
                    )}

                    {r.reason && (
                      <p className="text-[10px] text-ink-dim">Reason: {r.reason}</p>
                    )}

                    <div className="flex gap-2">
                      {r.targetType === "area" &&
                        r.minX !== undefined && r.minY !== undefined && r.maxX !== undefined && r.maxY !== undefined && (
                          <button
                            type="button"
                            onClick={() =>
                              handleTeleportToReportRegion({ minX: r.minX!, minY: r.minY!, maxX: r.maxX!, maxY: r.maxY! })
                            }
                            className="rounded border border-accent-crimson bg-accent-crimson/20 px-2 py-1 font-bold text-accent-crimson hover:bg-accent-crimson hover:text-on-accent"
                          >
                            📍 TELEPORT TO MARKED AREA
                          </button>
                      )}
                      {r.targetType === "area" &&
                        (r.minX === undefined || r.minY === undefined || r.maxX === undefined || r.maxY === undefined) &&
                        r.x !== undefined && r.y !== undefined && (
                          <button
                            type="button"
                            onClick={() => handleTeleportToReport(r.x!, r.y!, r.zoom ?? 1)}
                            className="rounded border border-chrome-border bg-chrome-bg px-2 py-1 font-bold text-ink hover:border-rust hover:text-accent-yellow"
                          >
                            📍 TELEPORT
                          </button>
                      )}
                      {r.targetType === "comment" && r.commentId && r.commentText !== undefined && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReportedComment(r._id, r.commentId!)}
                          className="rounded border border-accent-crimson bg-accent-crimson/20 px-2 py-1 font-bold text-accent-crimson hover:bg-accent-crimson hover:text-on-accent"
                        >
                          🗑️ DELETE COMMENT
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDismissReport(r._id)}
                        className="rounded border border-chrome-border bg-chrome-bg px-2 py-1 font-bold text-ink-dim hover:text-ink"
                      >
                        DISMISS
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: Telemetry */}
          {activeTab === "telemetry" && (
            <div className="grid grid-cols-2 gap-2 text-left font-mono text-xs">
              <div className="rounded border border-chrome-border bg-chrome-bg-raised p-2.5">
                <span className="block text-[10px] text-ink-dim">TOTAL STROKES</span>
                <span className="text-sm font-bold text-accent-yellow">
                  {telemetry?.strokeCount ?? "..."}
                </span>
              </div>
              <div className="rounded border border-chrome-border bg-chrome-bg-raised p-2.5">
                <span className="block text-[10px] text-ink-dim">ACTIVE PRESENCE</span>
                <span className="text-sm font-bold text-accent-green">
                  {telemetry?.activePresenceCount ?? "..."} Online
                </span>
              </div>
              <div className="rounded border border-chrome-border bg-chrome-bg-raised p-2.5">
                <span className="block text-[10px] text-ink-dim">PROTECTED ZONES</span>
                <span className="text-sm font-bold text-accent-yellow">
                  {telemetry?.protectedZoneCount ?? 0} Locked
                </span>
              </div>
              <div className="rounded border border-chrome-border bg-chrome-bg-raised p-2.5">
                <span className="block text-[10px] text-ink-dim">CURRENT SEQUENCE</span>
                <span className="text-sm font-bold text-accent-blue">
                  #{telemetry?.currentSequence ?? "..."}
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: Live AI Artist Agent */}
          {activeTab === "ai_agent" && (
            <div className="flex flex-col gap-3 text-left font-mono text-xs">
              <div className="flex flex-col gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">🤖 Live AI Artist Agent Dispatcher</span>
                <p className="text-[10px] text-ink-dim leading-relaxed">
                  Spawn a human-simulated AI artist agent. The AI artist moves a visible remote cursor across the canvas drawing stroke-by-stroke in real time so other users watch live human-like drawing.
                </p>

                <div
                  className={`rounded p-2 text-[10px] font-bold border leading-snug ${
                    hasGeminiKey
                      ? "border-accent-green/60 bg-accent-green/10 text-accent-green"
                      : "border-accent-yellow/60 bg-accent-yellow/10 text-accent-yellow"
                  }`}
                >
                  {aiEngineStatus}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Artist Display Name</label>
                    <input
                      type="text"
                      value={aiArtistName}
                      onChange={(e) => setAiArtistName(e.target.value)}
                      placeholder="e.g. ArtistAlex, PixelMaster"
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2.5 py-1.5 text-xs text-ink focus:border-rust focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Simulated Country</label>
                    <select
                      value={aiCountry}
                      onChange={(e) => setAiCountry(e.target.value)}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1.5 text-xs text-ink"
                    >
                      {POPULAR_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-ink-dim font-bold">Drawing Subject / Prompt</label>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. castle, rocket, dragon, cat, star..."
                    className="w-full rounded border border-chrome-border bg-chrome-bg px-2.5 py-1.5 text-xs text-ink focus:border-rust focus:outline-none"
                  />
                </div>

                {/* Optional Image-to-Stroke AI Painting */}
                <div className="rounded border border-chrome-border/70 bg-chrome-bg/50 p-2">
                  <label className="block text-[10px] text-accent-yellow font-bold uppercase">🖼️ Optional: Upload Image to Live AI Paint</label>
                  <p className="text-[9px] text-ink-dim mb-1">
                    Upload any photo/drawing file. The AI Artist will scan and live-paint the image stroke-by-stroke!
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setAiImageElement(null);
                        return;
                      }
                      const img = new Image();
                      img.onload = () => setAiImageElement(img);
                      img.src = URL.createObjectURL(file);
                    }}
                    className="block w-full text-xs text-ink file:mr-2 file:rounded file:border file:border-rust file:bg-rust file:px-2 file:py-0.5 file:text-xs file:font-bold file:text-on-accent hover:file:brightness-110"
                  />
                  {aiImageElement && (
                    <span className="mt-1 block text-[10px] font-bold text-accent-green">
                      ✓ Image loaded ({aiImageElement.width}x{aiImageElement.height}px). Ready for live AI stroke painting!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Zone X Coordinate</label>
                    <input
                      type="number"
                      value={aiZoneX}
                      onChange={(e) => setAiZoneX(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Zone Y Coordinate</label>
                    <input
                      type="number"
                      value={aiZoneY}
                      onChange={(e) => setAiZoneY(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Brush Texture</label>
                    <select
                      value={aiBrush}
                      onChange={(e) => setAiBrush(e.target.value)}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs text-ink"
                    >
                      <option value="neonGlow">Neon Glow</option>
                      <option value="brush">Standard Brush</option>
                      <option value="watercolor">Watercolor</option>
                      <option value="calligraphy">Calligraphy</option>
                      <option value="oilPaint">Oil Paint</option>
                      <option value="pencil">Pencil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim font-bold">Stroke Color</label>
                    <input
                      type="color"
                      value={aiColor}
                      onChange={(e) => setAiColor(e.target.value)}
                      className="h-7 w-full rounded border border-chrome-border bg-chrome-bg cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!onSpawnAiAgent) return;
                    onSpawnAiAgent(aiArtistName, aiPrompt, aiZoneX, aiZoneY, aiBrush as any, aiColor, aiCountry, aiImageElement);
                    setActionStatus(
                      `Success! Spawned AI Artist "${aiArtistName}" (${aiCountry}) ${
                        aiImageElement ? "painting uploaded image" : `drawing "${aiPrompt}"`
                      } at (${aiZoneX}, ${aiZoneY}).`,
                    );
                  }}
                  className="mt-2 rounded bg-accent-crimson px-3 py-2 font-mono text-xs font-bold uppercase text-white shadow-md hover:bg-accent-crimson-deep transition-all"
                >
                  🚀 SPAWN LIVE AI ARTIST AGENT
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
