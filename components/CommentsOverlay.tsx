"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/coordinates";
import type { Point } from "@/lib/types";

export interface CanvasComment {
  id: string;
  author: string;
  countryCode?: string;
  text: string;
  color: string; // e.g. yellow, pink, cyan, green
  worldPt: Point;
  createdAt: number;
}

export interface CommentsOverlayProps {
  comments: CanvasComment[];
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  onDeleteComment?: (id: string) => void;
  onReportComment?: (id: string) => void;
  onAdminDeleteComment?: (id: string) => void;
  isAdmin?: boolean;
}

export interface CommentsOverlayHandle {
  /** Repositions every currently-mounted pin straight in the DOM, bypassing
   * React's render cycle entirely. `camera` prop-driven positioning is one
   * render behind cameraRef during continuous pan/zoom (state updates
   * scheduled from a requestAnimationFrame callback don't paint in the same
   * frame the way updates from a React event handler do) — normally an
   * imperceptible sub-frame gap, but worldToScreen multiplies world-space
   * distance from the camera by zoom, so at low zoom a pin far from center
   * amplifies that one-frame gap into a visible jump. Call every frame
   * alongside the canvas's own redraw (same pattern as the mini-map's
   * viewport rect, which never had this problem for the same reason). */
  syncPositions: (camera: Camera, viewportWidth: number, viewportHeight: number) => void;
}

export const CommentsOverlay = forwardRef<CommentsOverlayHandle, CommentsOverlayProps>(
  function CommentsOverlay(
    { comments, camera, viewportWidth, viewportHeight, onDeleteComment, onReportComment, onAdminDeleteComment, isAdmin },
    ref,
  ) {
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
    const pinRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useImperativeHandle(
      ref,
      () => ({
        syncPositions(nextCamera, vw, vh) {
          for (const comment of comments) {
            const el = pinRefs.current.get(comment.id);
            if (!el) continue;
            const screenPt = worldToScreen(comment.worldPt.x, comment.worldPt.y, nextCamera, vw, vh);
            el.style.left = `${screenPt.x}px`;
            el.style.top = `${screenPt.y}px`;
          }
        },
      }),
      [comments],
    );

    if (!comments || comments.length === 0) return null;

    return (
      <div
        aria-label="Canvas Sticky Note Comments"
        className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      >
        {comments.map((comment) => {
          const screenPt = worldToScreen(
            comment.worldPt.x,
            comment.worldPt.y,
            camera,
            viewportWidth,
            viewportHeight,
          );

          // Off-screen culling — a frame of lag here just means a pin mounts
          // or unmounts one frame late, which is imperceptible (unlike a
          // frame of lag in its on-screen *position*, which is the bug this
          // component works around via syncPositions above).
          if (
            screenPt.x < -150 ||
            screenPt.x > viewportWidth + 150 ||
            screenPt.y < -150 ||
            screenPt.y > viewportHeight + 150
          ) {
            return null;
          }

          const isExpanded = activeCommentId === comment.id;

          return (
            <div
              key={comment.id}
              ref={(el) => {
                if (el) pinRefs.current.set(comment.id, el);
                else pinRefs.current.delete(comment.id);
              }}
              className="pointer-events-auto absolute"
              style={{
                left: screenPt.x,
                top: screenPt.y,
              }}
            >
              {isExpanded ? (
                <div className="flex flex-col gap-1.5 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.85)] backdrop-blur-md w-56 font-mono text-xs text-ink transition-transform scale-100">
                  <div className="flex items-center justify-between border-b border-chrome-border/60 pb-1 font-bold text-accent-yellow text-[11px]">
                    <span>📝 {comment.author}</span>
                    <button
                      type="button"
                      onClick={() => setActiveCommentId(null)}
                      className="text-ink-dim hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-ink text-[11px] leading-relaxed">
                    {comment.text}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[9px] text-ink-dim">
                    <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                    <div className="flex items-center gap-2">
                      {onReportComment && (
                        reportedIds.has(comment.id) ? (
                          <span className="text-accent-green">Reported</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onReportComment(comment.id);
                              setReportedIds((prev) => new Set(prev).add(comment.id));
                            }}
                            className="text-accent-yellow hover:underline"
                          >
                            🚩 Report
                          </button>
                        )
                      )}
                      {onDeleteComment && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(comment.id)}
                          className="text-accent-crimson hover:underline"
                        >
                          Delete
                        </button>
                      )}
                      {isAdmin && onAdminDeleteComment && (
                        <button
                          type="button"
                          onClick={() => onAdminDeleteComment(comment.id)}
                          className="text-accent-crimson hover:underline"
                          title="Delete this comment as admin"
                        >
                          🛡️ Admin Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveCommentId(comment.id)}
                  className="flex items-center gap-1 rounded-full border border-rust/80 bg-chrome-bg-raised/95 px-2.5 py-1 font-mono text-[10px] font-bold text-accent-yellow shadow-lg backdrop-blur-md hover:scale-110 transition-transform"
                  title={`Note by ${comment.author}: "${comment.text.slice(0, 30)}..."`}
                >
                  <span>📌</span>
                  <span className="max-w-[100px] truncate">{comment.author}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
