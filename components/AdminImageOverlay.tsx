"use client";

import { useRef, useState, useCallback } from "react";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/coordinates";
import { ChromeRivet } from "./ChromeRivet";

export interface AdminImagePlacement {
  file: File;
  url: string;
  worldX: number;
  worldY: number;
  width: number; // in world units
  height: number; // in world units
  aspectRatio: number;
}

export interface AdminImageOverlayProps {
  placement: AdminImagePlacement;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  onChangePlacement: (updated: AdminImagePlacement) => void;
  onConfirmStamp: () => void;
  onCancel: () => void;
  onDeleteImage: () => void;
  isStamping: boolean;
}

export function AdminImageOverlay({
  placement,
  camera,
  viewportWidth,
  viewportHeight,
  onChangePlacement,
  onConfirmStamp,
  onCancel,
  onDeleteImage,
  isStamping,
}: AdminImageOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ screenX: number; screenY: number; initialWorldX: number; initialWorldY: number; initialWidth: number }>({
    screenX: 0,
    screenY: 0,
    initialWorldX: 0,
    initialWorldY: 0,
    initialWidth: 0,
  });

  // Calculate screen position of the placement bounding box
  const topLeftScreen = worldToScreen(
    placement.worldX - placement.width / 2,
    placement.worldY - placement.height / 2,
    camera,
    viewportWidth,
    viewportHeight,
  );

  const screenW = placement.width * camera.zoom;
  const screenH = placement.height * camera.zoom;

  // Handle dragging position
  const handlePointerDownDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      screenX: e.clientX,
      screenY: e.clientY,
      initialWorldX: placement.worldX,
      initialWorldY: placement.worldY,
      initialWidth: placement.width,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Handle resizing corner
  const handlePointerDownResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    dragStartRef.current = {
      screenX: e.clientX,
      screenY: e.clientY,
      initialWorldX: placement.worldX,
      initialWorldY: placement.worldY,
      initialWidth: placement.width,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        const dxScreen = e.clientX - dragStartRef.current.screenX;
        const dyScreen = e.clientY - dragStartRef.current.screenY;
        const dxWorld = dxScreen / camera.zoom;
        const dyWorld = dyScreen / camera.zoom;

        onChangePlacement({
          ...placement,
          worldX: dragStartRef.current.initialWorldX + dxWorld,
          worldY: dragStartRef.current.initialWorldY + dyWorld,
        });
      } else if (isResizing) {
        const dxScreen = e.clientX - dragStartRef.current.screenX;
        const dxWorld = dxScreen / camera.zoom;
        const newWidth = Math.max(50, dragStartRef.current.initialWidth + dxWorld * 2);
        const newHeight = newWidth / placement.aspectRatio;

        onChangePlacement({
          ...placement,
          width: newWidth,
          height: newHeight,
        });
      }
    },
    [isDragging, isResizing, camera.zoom, placement, onChangePlacement],
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setIsResizing(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      aria-label="Admin Image Placement Overlay"
      className="pointer-events-auto absolute z-40 select-none group"
      style={{
        left: topLeftScreen.x,
        top: topLeftScreen.y,
        width: screenW,
        height: screenH,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Outer Glow & Rusted Border */}
      <div className="relative h-full w-full rounded border-2 border-dashed border-accent-yellow bg-black/30 shadow-[0_0_24px_rgba(224,67,43,0.5)]">
        <ChromeRivet className="top-1 left-1" />
        <ChromeRivet className="top-1 right-1" />
        <ChromeRivet className="bottom-1 left-1" />
        <ChromeRivet className="bottom-1 right-1" />

        {/* Image Preview */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={placement.url}
          alt="Canvas Image Stamp Target"
          className="h-full w-full object-contain pointer-events-none opacity-90"
        />

        {/* Floating Action Controls Bar (Pinned above top edge of image) */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 px-3 py-1.5 font-mono text-xs font-bold shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md whitespace-nowrap z-50">
          <button
            type="button"
            disabled={isStamping}
            onClick={onConfirmStamp}
            className="flex items-center gap-1 rounded bg-rust px-2.5 py-1 text-on-accent hover:brightness-110 disabled:opacity-50 transition-all"
            title="Stamp image onto canvas"
          >
            <span>🎨</span>
            <span>{isStamping ? "STAMPING..." : "STAMP IMAGE"}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded border border-chrome-border bg-chrome-bg px-2 py-1 text-ink hover:text-accent-yellow transition-all"
            title="Cancel image placement"
          >
            <span>❌</span>
            <span>CANCEL</span>
          </button>

          <button
            type="button"
            onClick={onDeleteImage}
            className="flex items-center gap-1 rounded border border-accent-crimson/50 bg-accent-crimson/20 px-2 py-1 text-accent-crimson hover:bg-accent-crimson hover:text-on-accent transition-all"
            title="Delete uploaded image"
          >
            <span>🗑️</span>
            <span>DELETE</span>
          </button>
        </div>

        {/* Drag Move Handle Overlay */}
        <div
          className="absolute inset-0 cursor-move flex items-center justify-center bg-rust/10 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={handlePointerDownDrag}
        >
          <span className="rounded bg-chrome-bg/90 px-2 py-1 font-mono text-[10px] font-bold text-accent-yellow border border-rust shadow">
            ✋ DRAG TO MOVE ({Math.round(placement.worldX)}, {Math.round(placement.worldY)})
          </span>
        </div>

        {/* Corner Resize Handle (Bottom-Right) */}
        <div
          className="absolute -bottom-3 -right-3 flex h-7 w-7 cursor-se-resize items-center justify-center rounded-full border-2 border-rust bg-accent-yellow text-chrome-bg shadow-md hover:scale-125 transition-transform"
          onPointerDown={handlePointerDownResize}
          title="Drag corner to resize image"
        >
          <span className="font-mono text-xs font-black">↘</span>
        </div>
      </div>
    </div>
  );
}
