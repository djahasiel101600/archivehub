/**
 * Synthesized audio + haptic feedback for scanner events (scan-to-fill bundle,
 * batch relocate, etc.). Tones are generated with the Web Audio API so no
 * asset files are needed, kept deliberately short and quiet so scanning near
 * other people stays non-intrusive, and every path degrades silently on
 * browsers/devices without support (autoplay policies, missing vibrate, etc.).
 */

export type ScanFeedbackKind = 'success' | 'error' | 'duplicate';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    // Browsers keep the context suspended until a user gesture — the scan
    // flow is gesture-initiated (opening the modal / granting camera), so a
    // resume attempt here usually unlocks it. Fail silently otherwise.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** One short enveloped oscillator note, starting `delay` seconds from now. */
function tone(
  ctx: AudioContext,
  frequency: number,
  delay: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  const t0 = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/** Short, low-volume chime/tone per scan outcome. Never throws. */
export function playScanFeedback(kind: ScanFeedbackKind): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    switch (kind) {
      case 'success':
        // Bright ascending two-note chime — document accepted
        tone(ctx, 880, 0, 0.11, 0.045);
        tone(ctx, 1318.5, 0.09, 0.13, 0.045);
        break;
      case 'error':
        // Low soft double-buzz — unknown/invalid/rejected code
        tone(ctx, 196, 0, 0.12, 0.05, 'triangle');
        tone(ctx, 164.8, 0.14, 0.14, 0.05, 'triangle');
        break;
      case 'duplicate':
        // Single quiet muted click — repeated scan, no spam
        tone(ctx, 523.3, 0, 0.045, 0.02, 'triangle');
        break;
    }
  } catch {
    // Feedback is a nicety — never let it break the scan loop
  }
}

/** Device vibration per scan outcome; no-op where the API is unsupported. */
export function vibrateScanFeedback(kind: ScanFeedbackKind): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (kind === 'success') {
      navigator.vibrate(35);
    } else if (kind === 'error') {
      navigator.vibrate([90, 40, 90]);
    } else {
      // Duplicate: very subtle single tap so repeat scans don't stay silent
      navigator.vibrate(12);
    }
  } catch {
    // Unsupported or blocked — ignore
  }
}

/** Convenience: fire both audio and haptic feedback for a scan outcome. */
export function scanFeedback(kind: ScanFeedbackKind): void {
  playScanFeedback(kind);
  vibrateScanFeedback(kind);
}
