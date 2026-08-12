import type { Point, ServerStroke } from "./types";

export interface GhostCursorState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  actionText: string;
  isDrawing: boolean;
}

export const GHOST_PROMPTS = [
  "Draw a retro 8-bit space rocket 🚀",
  "Sketch a steaming coffee cup ☕",
  "Doodle a neon cyberpunk star ⭐",
  "Draw a funny pixel cat 🐱",
  "Sketch a futuristic hovercar 🚗",
  "Draw a giant slice of pizza 🍕",
  "Doodle a friendly robot face 🤖",
  "Draw a mini treasure chest 💎",
];

export const INITIAL_GHOSTS: GhostCursorState[] = [
  {
    id: "ghost-1",
    name: "PixelGhost",
    color: "#007aff",
    x: 120,
    y: -80,
    targetX: 180,
    targetY: -120,
    actionText: "Doodling near Origin Plaza",
    isDrawing: false,
  },
  {
    id: "ghost-2",
    name: "NeonArtist",
    color: "#ffcc00",
    x: -150,
    y: 200,
    targetX: -200,
    targetY: 250,
    actionText: "Adding neon highlights",
    isDrawing: false,
  },
  {
    id: "ghost-3",
    name: "CoDoodler",
    color: "#ff3b30",
    x: 300,
    y: 150,
    targetX: 350,
    targetY: 180,
    actionText: "Looking for drawing partners",
    isDrawing: false,
  },
];

/** Generate a companion stroke (star, smiley, or arc) near user's drawn point */
export function generateCompanionStroke(
  center: Point,
  color: string = "#30b0c7"
): Omit<ServerStroke, "_id" | "_creationTime"> {
  const points: Point[] = [];
  const radius = 15 + Math.random() * 15;
  const numPoints = 8;

  // Generate a mini star / flower shape
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.4;
    points.push({
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    });
  }

  return {
    clientStrokeId: `ghost-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    clientId: "ai-codoodler-bot",
    username: "AI Co-Doodler",
    countryCode: "AI",
    mode: "draw",
    brushType: "neonGlow",
    color: color,
    width: 4,
    opacity: 0.85,
    points,
    clientTimestamp: Date.now(),
    sequence: Date.now(),
    serverTimestamp: Date.now(),
  };
}
