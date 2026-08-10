"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChromeRivet } from "./ChromeRivet";

export interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminPanelModal({ isOpen, onClose }: AdminPanelModalProps) {
  const [passcode, setPasscode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"moderation" | "broadcast" | "telemetry">("moderation");

  // Moderation state
  const [wipeMinX, setWipeMinX] = useState(0);
  const [wipeMinY, setWipeMinY] = useState(0);
  const [wipeMaxX, setWipeMaxX] = useState(5000);
  const [wipeMaxY, setWipeMaxY] = useState(5000);
  const [targetClientId, setTargetClientId] = useState("");
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);

  // Mutations & Queries
  const verifyPasscode = useMutation(api.admin.verifyPasscode);
  const wipeArea = useMutation(api.admin.wipeArea);
  const rollbackClient = useMutation(api.admin.rollbackClient);
  const publishBroadcast = useMutation(api.admin.publishBroadcast);
  const clearBroadcast = useMutation(api.admin.clearBroadcast);

  const telemetry = useQuery(
    api.admin.getTelemetry,
    authenticated ? { passcode } : "skip",
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    try {
      const isValid = await verifyPasscode({ passcode });
      if (isValid) {
        setAuthenticated(true);
        setAuthError(null);
      } else {
        setAuthenticated(false);
        setAuthError("Invalid admin passcode. Access denied.");
      }
    } catch {
      setAuthenticated(false);
      setAuthError("Failed to verify passcode.");
    }
  };

  const handleWipeArea = async () => {
    try {
      setActionStatus("Wiping canvas area...");
      const res = await wipeArea({
        passcode,
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
        passcode,
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
        passcode,
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
      await clearBroadcast({ passcode });
      setActionStatus("Success! Broadcast cleared.");
    } catch (err: unknown) {
      setActionStatus(`Error: ${err instanceof Error ? err.message : "Clear failed"}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Admin Control Center"
        className="relative flex w-full max-w-lg flex-col gap-4 rounded-sm border-2 border-rust bg-chrome-bg/95 p-5 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.85)]"
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
                Canvas moderation, operations &amp; live telemetry
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
          <form onSubmit={handleAuthenticate} className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1.5 text-left font-mono">
              <label htmlFor="admin-passcode" className="text-xs font-bold text-ink">
                Enter Admin Passcode:
              </label>
              <input
                id="admin-passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
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
            <div className="flex border-b border-chrome-border/60 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("moderation")}
                className={`flex-1 py-1.5 font-bold transition-colors ${
                  activeTab === "moderation"
                    ? "border-b-2 border-rust text-accent-yellow"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                🛡️ MODERATION
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("broadcast")}
                className={`flex-1 py-1.5 font-bold transition-colors ${
                  activeTab === "broadcast"
                    ? "border-b-2 border-rust text-accent-yellow"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                📢 BROADCAST
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("telemetry")}
                className={`flex-1 py-1.5 font-bold transition-colors ${
                  activeTab === "telemetry"
                    ? "border-b-2 border-rust text-accent-yellow"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                📊 TELEMETRY
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

            {/* TAB 2: Broadcast */}
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

            {/* TAB 3: Telemetry */}
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
      </div>
    </div>
  );
}
