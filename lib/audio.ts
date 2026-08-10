/**
 * Zero-dependency Web Audio API procedural sound engine for AlwaysDraw.
 * Synthesizes realistic brush stroke audio feedback (spray hiss, pencil scratch,
 * chalk friction, wet oil glide, rubber eraser sound) + ambient hum.
 */

let audioCtx: AudioContext | null = null;
let isMuted = true;
let noiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
  if (!muted) {
    getAudioContext();
  }
}

export function getAudioMuted(): boolean {
  return isMuted;
}

export function toggleAudioMuted(): boolean {
  isMuted = !isMuted;
  if (!isMuted) {
    getAudioContext();
  }
  return isMuted;
}

/**
 * Play a procedural sound effect matching the active brush type and movement speed.
 */
export function playBrushSound(brushType = "brush", isErase = false) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  if (isErase) {
    // Rubber eraser scraping sound
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, now);
    filter.Q.setValueAtTime(2, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  } else if (brushType === "marker" || brushType === "neonGlow" || brushType === "glitter") {
    // Spray paint / marker pressure hiss
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(1, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  } else if (brushType === "pencil" || brushType === "charcoal" || brushType === "chalk") {
    // Grainy scratch friction sound
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2500, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  } else {
    // Soft paint glide
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  }

  noise.start(now);
  noise.stop(now + 0.12);
}
