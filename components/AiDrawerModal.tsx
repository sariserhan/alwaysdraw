"use client";

import { useState } from "react";
import type { BrushType } from "@/lib/types";
import { ChromeRivet } from "./ChromeRivet";

export interface AiDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, brushType: BrushType, color: string) => void;
}

export function AiDrawerModal({ isOpen, onClose, onGenerate }: AiDrawerModalProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedColor, setSelectedColor] = useState("#d94626");
  const [selectedBrush, setSelectedBrush] = useState<BrushType>("neonGlow");

  if (!isOpen) return null;

  const presets = [
    { label: "🏰 Castle", value: "castle" },
    { label: "🚀 Space Rocket", value: "rocket" },
    { label: "⭐ Star", value: "star" },
    { label: "🐱 Pixel Cat", value: "cat" },
    { label: "🎨 Symbol", value: "mandala" },
  ];

  const colors = ["#d94626", "#30b0c7", "#ffcc00", "#10b981", "#af52de", "#ffffff"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onGenerate(prompt, selectedBrush, selectedColor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-md border-2 border-rust bg-chrome-bg/95 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-ink">
        <ChromeRivet className="top-2 left-2" />
        <ChromeRivet className="top-2 right-2" />

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-chrome-border/70 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-accent-yellow">
              AI Vector Painter
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* PROMPT INPUT */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-ink-dim mb-2">
              What should the AI draw?
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., castle, rocket, star, cat, robot..."
              className="w-full rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2.5 font-mono text-sm text-ink focus:border-rust focus:outline-none"
              autoFocus
            />
          </div>

          {/* PRESETS */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-ink-dim mb-2">
              Quick Suggestions
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setPrompt(preset.value)}
                  className="rounded-sm border border-chrome-border bg-chrome-bg-raised px-2.5 py-1 font-mono text-xs font-semibold text-ink-dim hover:border-rust hover:text-accent-yellow transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* COLOR PICKER */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-ink-dim mb-2">
              Stroke Color
            </label>
            <div className="flex items-center gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`h-7 w-7 rounded-full border-2 shadow-sm transition-transform ${
                    selectedColor === c ? "scale-110 border-white ring-2 ring-rust" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* GENERATE SUBMIT */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="w-full rounded-sm bg-accent-crimson py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent-crimson-deep disabled:opacity-50 transition-all"
          >
            ✨ Generate AI Drawing
          </button>
        </form>
      </div>
    </div>
  );
}
