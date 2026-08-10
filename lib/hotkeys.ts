import type { Tool } from "./types";

export interface HotkeyAction {
  key: string;
  label: string;
  description: string;
  tool?: Tool;
  action?: "zoomIn" | "zoomOut" | "resetView" | "toggleHeatmap" | "toggleHelp";
}

export const HOTKEY_MAP: HotkeyAction[] = [
  { key: "B", label: "Brush Tool", description: "Switch to Brush / Texture draw mode", tool: "brush" },
  { key: "E", label: "Eraser Tool", description: "Switch to Eraser mode", tool: "eraser" },
  { key: "H", label: "Pan / Hand", description: "Pan across the 20,000x20,000 wall", tool: "pan" },
  { key: "M", label: "Magnifier", description: "Hover circular loupe to inspect artwork", tool: "magnifier" },
  { key: "S", label: "Shape Tool", description: "Draw rectangle, circle, line, or triangle", tool: "shape" },
  { key: "T", label: "Stencil Tool", description: "Spray industrial stencils (Biohazard, Crown, Skull)", tool: "stencil" },
  { key: "R", label: "Ruler Tool", description: "Measure distance between canvas points", tool: "ruler" },
  { key: "L", label: "Laser Pointer", description: "Temporary glowing laser trail fading after 2s", tool: "laser" },
  { key: "I", label: "Eyedropper", description: "Sample color from any mark on the wall", tool: "eyedropper" },
  { key: "G", label: "Toggle Grid", description: "Toggle architectural grid overlay", action: "toggleHeatmap" },
  { key: "P", label: "FPS Profiler HUD", description: "Toggle real-time 60 FPS & VRAM memory profiler HUD", action: "toggleHeatmap" },
  { key: "F", label: "Toggle Heatmap", description: "Show/hide activity density heatmap", action: "toggleHeatmap" },
  { key: "+", label: "Zoom In", description: "Zoom camera closer into artwork", action: "zoomIn" },
  { key: "-", label: "Zoom Out", description: "Zoom camera out to see wider wall", action: "zoomOut" },
  { key: "0", label: "Reset View", description: "Reset camera zoom and center view", action: "resetView" },
  { key: "?", label: "Hotkeys Map", description: "Show this keyboard shortcuts menu", action: "toggleHelp" },
  { key: "Shift+A", label: "Admin Panel", description: "Open Moderation & Operations Control Center" },
];
