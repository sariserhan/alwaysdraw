"use client";

import { useState } from "react";
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
}

export function CommentsOverlay({
  comments,
  camera,
  viewportWidth,
  viewportHeight,
  onDeleteComment,
  onReportComment,
}: CommentsOverlayProps) {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

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

        // Off-screen culling
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
}
