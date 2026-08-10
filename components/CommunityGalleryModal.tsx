"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChromeRivet } from "./ChromeRivet";
import { MAX_COMMENT_LENGTH } from "@/convex/constants";
import { t, type Locale } from "@/lib/i18n";
import type { Point } from "@/lib/types";

export interface CommunityGalleryModalProps {
  clientId: string;
  username: string | undefined;
  onTeleport: (pt: Point, zoom: number, label: string) => void;
  locale: Locale;
  iconOnly?: boolean;
}

export function CommunityGalleryModal({ clientId, username, onTeleport, locale, iconOnly = false }: CommunityGalleryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<Id<"bookmarks"> | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const entries = useQuery(api.bookmarks.listGallery, isOpen ? { clientId, limit: 30 } : "skip");
  const comments = useQuery(
    api.bookmarks.listComments,
    expandedId ? { bookmarkId: expandedId, limit: 50 } : "skip",
  );
  const toggleVote = useMutation(api.bookmarks.toggleVote);
  const addComment = useMutation(api.bookmarks.addComment);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleTeleport = (entry: NonNullable<typeof entries>[number]) => {
    onTeleport({ x: entry.x, y: entry.y }, entry.zoom, entry.title);
    setIsOpen(false);
  };

  const handleToggleExpand = (id: Id<"bookmarks">) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setCommentDraft("");
  };

  const handleSubmitComment = (e: React.FormEvent, bookmarkId: Id<"bookmarks">) => {
    e.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;
    addComment({ bookmarkId, clientId, username, text }).catch(() => {});
    setCommentDraft("");
  };

  const [hero, ...rest] = entries ?? [];

  const modalMarkup =
    isOpen && typeof document !== "undefined" ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-modal-title"
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-start overflow-y-auto bg-black/80 p-4 pt-16 sm:pt-20 backdrop-blur-md animate-fade-in pointer-events-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}
      >
        <div className="relative my-auto w-full max-w-2xl rounded-sm border-2 border-rust bg-chrome-bg p-5 sm:p-6 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.95)]">
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />
          <ChromeRivet className="bottom-2 left-2" />
          <ChromeRivet className="bottom-2 right-2" />

          <div className="flex items-center justify-between border-b border-rust/60 pb-3">
            <div>
              <h2 id="gallery-modal-title" className="font-display text-lg font-bold uppercase tracking-wide text-ink">
                {t(locale, "gallery_title")}
              </h2>
              <p className="font-mono text-xs text-accent-yellow">{t(locale, "gallery_subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t(locale, "close")}
              className="flex h-7 w-7 items-center justify-center rounded border border-chrome-border bg-chrome-bg-raised font-mono text-sm font-bold text-ink transition-colors hover:border-rust hover:text-accent-crimson"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1 font-mono">
            {entries === undefined && (
              <p className="py-8 text-center text-xs text-ink-dim">{t(locale, "loading")}</p>
            )}
            {entries !== undefined && entries.length === 0 && (
              <p className="py-8 text-center text-xs italic text-ink-dim">{t(locale, "gallery_empty")}</p>
            )}

            {hero && (
              <div className="rounded-sm border-2 border-accent-yellow bg-gradient-to-b from-accent-yellow/15 to-chrome-bg-raised p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-accent-yellow">
                  <span>🏆</span>
                  <span>{t(locale, "gallery_hero_label")}</span>
                </div>
                <GalleryEntry
                  entry={hero}
                  locale={locale}
                  isExpanded={expandedId === hero._id}
                  comments={expandedId === hero._id ? comments : undefined}
                  commentDraft={commentDraft}
                  onCommentDraftChange={setCommentDraft}
                  onTeleport={() => handleTeleport(hero)}
                  onToggleVote={() => toggleVote({ bookmarkId: hero._id, clientId }).catch(() => {})}
                  onToggleExpand={() => handleToggleExpand(hero._id)}
                  onSubmitComment={(e) => handleSubmitComment(e, hero._id)}
                />
              </div>
            )}

            {rest.map((entry, i) => (
              <div key={entry._id} className="rounded-sm border border-chrome-border bg-chrome-bg-raised/70 p-3">
                <div className="mb-1 font-mono text-[10px] font-bold text-ink-dim">#{i + 2}</div>
                <GalleryEntry
                  entry={entry}
                  locale={locale}
                  isExpanded={expandedId === entry._id}
                  comments={expandedId === entry._id ? comments : undefined}
                  commentDraft={commentDraft}
                  onCommentDraftChange={setCommentDraft}
                  onTeleport={() => handleTeleport(entry)}
                  onToggleVote={() => toggleVote({ bookmarkId: entry._id, clientId }).catch(() => {})}
                  onToggleExpand={() => handleToggleExpand(entry._id)}
                  onSubmitComment={(e) => handleSubmitComment(e, entry._id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center justify-center rounded-sm border border-chrome-border bg-chrome-bg-raised/90 text-ink shadow-sm transition-colors hover:border-rust hover:text-accent-yellow ${
          iconOnly
            ? "h-7 w-7 text-sm"
            : "h-[28px] w-full gap-1.5 px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap"
        }`}
        title={t(locale, "gallery_title")}
        aria-label={t(locale, "gallery_title")}
      >
        <span>🖼️</span>
        {!iconOnly && <span>{t(locale, "gallery").toUpperCase()}</span>}
      </button>

      {modalMarkup && createPortal(modalMarkup, document.body)}
    </>
  );
}

interface GalleryEntryData {
  _id: Id<"bookmarks">;
  title: string;
  x: number;
  y: number;
  zoom: number;
  clientId: string;
  voteCount: number;
  commentCount: number;
  hasVoted: boolean;
}

function GalleryEntry({
  entry,
  locale,
  isExpanded,
  comments,
  commentDraft,
  onCommentDraftChange,
  onTeleport,
  onToggleVote,
  onToggleExpand,
  onSubmitComment,
}: {
  entry: GalleryEntryData;
  locale: Locale;
  isExpanded: boolean;
  comments: { _id: string; clientId: string; username?: string; text: string; createdAt: number }[] | undefined;
  commentDraft: string;
  onCommentDraftChange: (v: string) => void;
  onTeleport: () => void;
  onToggleVote: () => void;
  onToggleExpand: () => void;
  onSubmitComment: (e: React.FormEvent) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleVote}
          aria-pressed={entry.hasVoted}
          title={t(locale, "upvote")}
          className={`flex shrink-0 flex-col items-center rounded border px-2 py-1 transition-colors ${
            entry.hasVoted
              ? "border-rust bg-rust text-on-accent"
              : "border-chrome-border bg-chrome-bg text-ink-dim hover:border-rust hover:text-accent-yellow"
          }`}
        >
          <span className="text-xs leading-none">▲</span>
          <span className="text-[10px] font-bold leading-none">{entry.voteCount}</span>
        </button>

        <button
          type="button"
          onClick={onTeleport}
          className="min-w-0 flex-1 text-left"
          title={t(locale, "teleport_here")}
        >
          <span className="block truncate text-xs font-bold text-ink hover:text-accent-yellow">{entry.title}</span>
          <span className="block text-[10px] text-ink-dim">
            ({entry.x}, {entry.y}) · {entry.zoom}x
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex shrink-0 items-center gap-1 rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-[10px] font-bold text-ink-dim transition-colors hover:border-rust hover:text-accent-blue"
        >
          <span>💬</span>
          <span>{entry.commentCount}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="mt-2.5 space-y-2 border-t border-chrome-border/60 pt-2.5 pl-1">
          {comments === undefined && <p className="text-[10px] text-ink-dim">{t(locale, "loading")}</p>}
          {comments !== undefined && comments.length === 0 && (
            <p className="text-[10px] italic text-ink-dim">{t(locale, "gallery_no_comments")}</p>
          )}
          {comments?.map((c) => (
            <div key={c._id} className="rounded bg-chrome-bg-raised px-2 py-1.5">
              <span className="block text-[10px] font-bold text-accent-yellow">{c.username ?? c.clientId}</span>
              <span className="block text-xs text-ink">{c.text}</span>
            </div>
          ))}
          <form onSubmit={onSubmitComment} className="flex items-center gap-1.5">
            <input
              type="text"
              value={commentDraft}
              onChange={(e) => onCommentDraftChange(e.target.value)}
              placeholder={t(locale, "gallery_comment_placeholder")}
              maxLength={MAX_COMMENT_LENGTH}
              className="flex-1 rounded-sm border border-chrome-border bg-chrome-bg px-2 py-1 text-xs text-ink placeholder:text-ink-dim/50 focus:border-rust focus:outline-none"
            />
            <button
              type="submit"
              disabled={!commentDraft.trim()}
              className="rounded-sm border border-rust bg-rust/30 px-2.5 py-1 text-[10px] font-bold text-ink transition-colors hover:bg-rust hover:text-white disabled:opacity-40"
            >
              {t(locale, "save").toUpperCase()}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
