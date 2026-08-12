"use client";

import { useState } from "react";
import { ChromeRivet } from "./ChromeRivet";

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function ShareModal({ isOpen, onClose, shareUrl }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  if (!isOpen) return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const tweetText = encodeURIComponent("Come draw with me live on AlwaysDraw! 🎨 The world's shared real-time canvas:");
  const redditTitle = encodeURIComponent("Draw with me live on AlwaysDraw — The World's Shared Real-Time Canvas");

  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`;
  const redditUrl = `https://www.reddit.com/submit?title=${redditTitle}&url=${encodedUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${tweetText}%20${encodedUrl}`;

  const embedCode = `<iframe src="${shareUrl.replace('/canvas', '/embed')}" width="800" height="500" style="border:0;border-radius:8px;" allow="autoplay; fullscreen"></iframe>`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-md border-2 border-rust bg-chrome-bg/95 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-ink">
        <ChromeRivet className="top-2 left-2" />
        <ChromeRivet className="top-2 right-2" />

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-chrome-border/70 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-accent-yellow">
              Invite &amp; Share Canvas
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-dim hover:text-ink font-mono font-bold text-lg px-2"
          >
            ✕
          </button>
        </div>

        {/* VIRAL SOCIAL BLASTER BUTTONS */}
        <div className="mb-6">
          <label className="block font-mono text-xs font-bold uppercase tracking-wider text-ink-dim mb-2.5">
            1-Click Social Media Blaster
          </label>
          <div className="grid grid-cols-3 gap-3">
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised p-2.5 font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors shadow-sm"
            >
              <span>𝕏</span>
              <span>X / Twitter</span>
            </a>

            <a
              href={redditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised p-2.5 font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors shadow-sm"
            >
              <span>🤖</span>
              <span>Reddit</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised p-2.5 font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow transition-colors shadow-sm"
            >
              <span>💬</span>
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        {/* DIRECT COORDINATE LINK */}
        <div className="mb-6">
          <label className="block font-mono text-xs font-bold uppercase tracking-wider text-ink-dim mb-2">
            Direct Viewport Coordinate Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2 font-mono text-xs text-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`rounded-sm px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider shadow-sm transition-colors ${
                copiedLink
                  ? "bg-emerald-600 text-white"
                  : "bg-accent-crimson text-white hover:bg-accent-crimson-deep"
              }`}
            >
              {copiedLink ? "✓ Copied!" : "Copy Link"}
            </button>
          </div>
        </div>

        {/* EMBED HTML SNIPPET */}
        <div>
          <label className="block font-mono text-xs font-bold uppercase tracking-wider text-ink-dim mb-2">
            Embed Canvas Widget (for Blogs &amp; Websites)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={embedCode}
              className="flex-1 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2 font-mono text-xs text-ink-dim focus:outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopyEmbed}
              className={`rounded-sm border px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                copiedEmbed
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-chrome-border bg-chrome-bg-raised text-ink hover:border-rust hover:text-accent-yellow"
              }`}
            >
              {copiedEmbed ? "✓ Copied!" : "Copy Embed"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
