"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./WallLoadingOverlay.module.css";

export function WallLoadingOverlay({ progress, error }: { progress: RefObject<number>; error: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // Only this small overlay re-renders as pages arrive, not GlobalCanvas
    // and its toolbars, menus, minimap, and subscriptions.
    const timer = setInterval(() => setCount(progress.current), 100);
    return () => clearInterval(timer);
  }, [progress]);

  return createPortal(
    <div className={styles.overlay} data-wall-loading="" data-error={error}>
      <div className={styles.card}>
        <div className={styles.eyebrow}><span className={styles.dot} /> A WALL MADE BY EVERYONE</div>
        <div className={styles.art} aria-hidden="true">
          <span className={styles.spark}>✳</span>
          <svg viewBox="0 0 280 150" fill="none">
            <path className={styles.swash} d="M44 98 C58 30 108 18 102 68 C95 119 138 126 145 66 C151 12 204 16 194 77 C181 141 219 119 239 61" pathLength="1" />
            <path className={styles.underline} d="M62 129 Q136 112 220 129" pathLength="1" />
            <g className={styles.pencil}>
              <path d="m218 29 12-18 28 19-12 18z" fill="#e0b13a" stroke="#24221e" strokeWidth="3" />
              <path d="m218 29-5 20 20-9z" fill="#f5f1e6" stroke="#24221e" strokeWidth="3" />
              <path d="m213 49 3-9 6 5z" fill="#24221e" />
              <path d="m249 24 5-7q4-5 9-1l7 5q5 4 1 9l-5 7z" fill="#e0432b" stroke="#24221e" strokeWidth="3" />
            </g>
          </svg>
          <span className={styles.littleSpark}>+</span>
        </div>
        <div role={error ? "alert" : "status"}>
          <h2 className={styles.title}>{error ? "the wall couldn't load" : "loading the wall"}<span className={styles.dots}>{error ? "" : "…"}</span></h2>
          <p className={styles.description}>{error ? "Our paint delivery got held up. Let's give it another go." : "A little ink. A lot of imagination."}</p>
        </div>
        {error ? (
          <button className={styles.retry} onClick={() => window.location.reload()}>Try again ↗</button>
        ) : (
          <>
            <div className={styles.counter} aria-live="off">
              <span className={styles.number}>{count.toLocaleString()}</span>
              <span className={styles.counterLabel}>strokes gathered</span>
              <span className={styles.counterStar} aria-hidden="true">✦</span>
            </div>
            <div className={styles.track} aria-hidden="true"><span /></div>
            <p className={styles.footnote}>Getting the latest picture ready for you.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
