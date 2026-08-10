"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChromeRivet } from "./ChromeRivet";

export interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  authenticated: boolean;
  passcode: string;
  onAuthenticate: (passcode: string) => Promise<boolean>;
}

export function AdminPanelModal({
  isOpen,
  onClose,
  authenticated,
  passcode: activePasscode,
  onAuthenticate,
}: AdminPanelModalProps) {
  const [inputPasscode, setInputPasscode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"moderation" | "broadcast" | "image" | "telemetry">("moderation");

  // Moderation state
  const [wipeMinX, setWipeMinX] = useState(0);
  const [wipeMinY, setWipeMinY] = useState(0);
  const [wipeMaxX, setWipeMaxX] = useState(5000);
  const [wipeMaxY, setWipeMaxY] = useState(5000);
  const [targetClientId, setTargetClientId] = useState("");
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");

  // Image Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [stampX, setStampX] = useState(10000);
  const [stampY, setStampY] = useState(10000);
  const [stampWidthPx, setStampWidthPx] = useState(400);
  const [isStamping, setIsStamping] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Mutations & Queries
  const wipeArea = useMutation(api.admin.wipeArea);
  const rollbackClient = useMutation(api.admin.rollbackClient);
  const publishBroadcast = useMutation(api.admin.publishBroadcast);
  const clearBroadcast = useMutation(api.admin.clearBroadcast);
  const submitStroke = useMutation(api.strokes.submit);

  const telemetry = useQuery(
    api.admin.getTelemetry,
    authenticated ? { passcode: activePasscode } : "skip",
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleStampImage = async () => {
    if (!imageFile || !imagePreviewUrl) return;
    setIsStamping(true);
    setActionStatus("Processing image pixels...");

    try {
      const img = new Image();
      img.src = imagePreviewUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });

      const canvas = document.createElement("canvas");
      const maxDim = 70; // Grid density
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
      if (!ctx) throw new Error("Could not create off-screen canvas context");

      ctx.drawImage(img, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH).data;

      const pixelSize = stampWidthPx / targetW;
      const halfW = stampWidthPx / 2;
      const halfH = (stampWidthPx * (targetH / targetW)) / 2;

      // Group pixel points by hex color for instant ultra-fast batch submission
      const pointsByColor = new Map<string, { points: { x: number; y: number }[]; opacity: number }>();

      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const idx = (y * targetW + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const a = imgData[idx + 3] / 255;

          if (a < 0.1) continue;

          // Quantize color slightly to group similar shades efficiently
          const qR = Math.round(r / 8) * 8;
          const qG = Math.round(g / 8) * 8;
          const qB = Math.round(b / 8) * 8;
          const colorHex = `#${((1 << 24) + (Math.min(255, qR) << 16) + (Math.min(255, qG) << 8) + Math.min(255, qB)).toString(16).slice(1)}`;
          const px = Math.round(stampX - halfW + x * pixelSize + pixelSize / 2);
          const py = Math.round(stampY - halfH + y * pixelSize + pixelSize / 2);

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
        // Chunk points in groups of max 90 (below MAX_POINTS_PER_STROKE = 100 limit)
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

      setActionStatus(`Stamping ${totalPixels} pixels across ${batchTasks.length} batched strokes...`);
      await Promise.all(batchTasks);

      setActionStatus(`Success! Stamped image (${totalPixels} pixels) onto canvas at (${stampX}, ${stampY}).`);
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Image stamp failed"}`);
    } finally {
      setIsStamping(false);
    }
  };

  const handleWipeArea = async () => {
    try {
      setActionStatus("Wiping canvas area...");
      const res = await wipeArea({
        passcode: activePasscode,
        minX: Number(wipeMinX),
        minY: Number(wipeMinY),
        maxX: Number(wipeMaxX),
        maxY: Number(wipeMaxY),
      });
      setActionStatus(`Success! Purged ${res.deletedCount} strokes from area.`);
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Wipe failed"}`);
    }
  };

  const handleRollbackClient = async () => {
    if (!targetClientId.trim()) return;
    try {
      setActionStatus(`Rolling back Client ID: ${targetClientId}...`);
      const res = await rollbackClient({
        passcode: activePasscode,
        targetClientId,
      });
      setActionStatus(`Success! Purged ${res.deletedCount} strokes drawn by ${targetClientId}.`);
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Rollback failed"}`);
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

  if (!isOpen) return null;

  return (
    <aside
      ref={modalRef}
      role="dialog"
      aria-label="Admin Control Center"
      className="pointer-events-auto fixed left-4 top-28 bottom-20 z-40 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-sm border-2 border-rust bg-chrome-bg/95 p-4 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.85)] backdrop-blur-md"
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
              Canvas moderation, image upload &amp; live telemetry
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
              placeholder="Default: alwaysdraw-admin-2026"
              className="rounded border border-chrome-border bg-chrome-bg-raised px-3 py-2 text-xs font-mono text-ink focus:border-rust focus:outline-none"
            />
            <span className="text-[10px] text-ink-dim">
              Default local key: <code className="text-accent-yellow">alwaysdraw-admin-2026</code>
            </span>
          </div>
          {authError && <span className="font-mono text-xs text-accent-crimson">{authError}</span>}
          <button
            type="submit"
            className="rounded border-2 border-rust bg-rust px-4 py-2 font-mono text-xs font-bold text-on-accent transition hover:brightness-110"
          >
            UNLOCK ADMIN CONTROLS
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Navigation Tabs */}
          <div className="flex border-b border-chrome-border/60 font-mono text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("moderation")}
              className={`px-2 py-1.5 font-bold transition-colors whitespace-nowrap ${
                activeTab === "moderation"
                  ? "border-b-2 border-rust text-accent-yellow"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              🛡️ MOD
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("image")}
              className={`px-2 py-1.5 font-bold transition-colors whitespace-nowrap ${
                activeTab === "image"
                  ? "border-b-2 border-rust text-accent-yellow"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              🖼️ UPLOAD
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("broadcast")}
              className={`px-2 py-1.5 font-bold transition-colors whitespace-nowrap ${
                activeTab === "broadcast"
                  ? "border-b-2 border-rust text-accent-yellow"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              📢 BANNER
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("telemetry")}
              className={`px-2 py-1.5 font-bold transition-colors whitespace-nowrap ${
                activeTab === "telemetry"
                  ? "border-b-2 border-rust text-accent-yellow"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              📊 STATS
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
              {/* Area Wipe */}
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-crimson uppercase">🧹 Area Wipe (Bounding Box)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-dim">Min X</label>
                    <input
                      type="number"
                      value={wipeMinX}
                      onChange={(e) => setWipeMinX(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim">Min Y</label>
                    <input
                      type="number"
                      value={wipeMinY}
                      onChange={(e) => setWipeMinY(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim">Max X</label>
                    <input
                      type="number"
                      value={wipeMaxX}
                      onChange={(e) => setWipeMaxX(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-dim">Max Y</label>
                    <input
                      type="number"
                      value={wipeMaxY}
                      onChange={(e) => setWipeMaxY(Number(e.target.value))}
                      className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleWipeArea}
                  className="mt-1 rounded bg-accent-crimson px-3 py-1.5 font-bold text-on-accent hover:brightness-110"
                >
                  PURGE AREA STROKES
                </button>
              </div>

              {/* Rollback Client */}
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

          {/* TAB 2: Image Upload & Stamp */}
          {activeTab === "image" && (
            <div className="flex flex-col gap-3 text-left font-mono text-xs">
              <div className="flex flex-col gap-2 rounded border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <span className="font-bold text-accent-yellow uppercase">🖼️ Image Upload &amp; Stamp</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="block w-full text-xs text-ink file:mr-2 file:rounded file:border file:border-rust file:bg-rust file:px-2 file:py-1 file:text-xs file:font-bold file:text-on-accent hover:file:brightness-110"
                />

                {imagePreviewUrl && (
                  <div className="flex flex-col gap-2 mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreviewUrl}
                      alt="Stamp Preview"
                      className="h-28 w-full rounded border border-chrome-border object-contain bg-black/40"
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-ink-dim">Stamp X</label>
                        <input
                          type="number"
                          value={stampX}
                          onChange={(e) => setStampX(Number(e.target.value))}
                          className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-ink-dim">Stamp Y</label>
                        <input
                          type="number"
                          value={stampY}
                          onChange={(e) => setStampY(Number(e.target.value))}
                          className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-ink-dim">Width (px)</label>
                        <input
                          type="number"
                          value={stampWidthPx}
                          onChange={(e) => setStampWidthPx(Number(e.target.value))}
                          className="w-full rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isStamping}
                      onClick={handleStampImage}
                      className="mt-1 rounded border-2 border-rust bg-rust px-3 py-2 font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
                    >
                      {isStamping ? "STAMPING IMAGE..." : "🖼️ STAMP IMAGE ONTO CANVAS"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Broadcast */}
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
            </div>
          )}

          {/* TAB 4: Telemetry */}
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
                <span className="block text-[10px] text-ink-dim">SNAPSHOT COUNT</span>
                <span className="text-sm font-bold text-ink">
                  {telemetry?.snapshotCount ?? "..."}
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
        </div>
      )}
    </aside>
  );
}
