/**
 * Synthesized audio + haptic feedback for scanner events (scan-to-fill bundle,
 * batch relocate, etc.). Tones are generated with the Web Audio API so no
 * asset files are needed, kept short so scanning near other people stays
 * non-intrusive, and every path degrades gracefully on browsers/devices
 * without support (autoplay policies, missing vibrate, etc.).
 *
 * IMPORTANT — autoplay policy: browsers keep a newly created AudioContext
 * suspended until it is created/resumed inside a user gesture. Camera scan
 * decodes fire from worker/rAF callbacks (NOT gestures), so unlocking lazily
 * at first decode would leave the context permanently suspended = silence.
 * We therefore attach capture-phase gesture listeners at module import time:
 * the very first pointer/keydown anywhere (e.g. clicking "New Empty Bundle"
 * or switching scanner tabs) creates and resumes the context, and all later
 * scan-decode sounds play freely.
 */

export type ScanFeedbackKind = 'success' | 'error' | 'duplicate';

let audioCtx: AudioContext | null = null;
let gestureListenersAttached = false;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        console.debug('[scanFeedback] Web Audio API unsupported — audio feedback disabled');
        return null;
      }
      audioCtx = new Ctx();
      console.debug('[scanFeedback] AudioContext created, state =', audioCtx.state);
    }
    if (audioCtx.state === 'suspended') {
      // Only succeeds inside/after a user gesture — see unlock listeners below
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Register once, at module import, BEFORE any user gesture happens. The
 * first pointerdown/keydown anywhere on the page creates + resumes the
 * AudioContext, permanently unlocking scan sounds for the session.
 */
function attachGestureUnlockListeners(): void {
  if (gestureListenersAttached || typeof window === 'undefined') return;
  gestureListenersAttached = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    // State may flip to 'running' asynchronously right after resume()
    const check = () => {
      if (ctx.state === 'running') {
        console.debug('[scanFeedback] audio unlocked by user gesture');
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      }
    };
    check();
    setTimeout(check, 150);
  };
  // Capture phase so the unlock fires even if a handler stops propagation
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

attachGestureUnlockListeners();

/**
 * Explicit unlock hook for scanner entry points: call it from any modal
 * effect that runs after a user gesture (e.g. opening the scan modal).
 * Safe to call repeatedly. Covers the edge case where the module was only
 * imported at the same moment as the opening click, which can race the
 * capture-phase listeners above.
 */
export function ensureScanAudioUnlocked(): void {
  getAudioContext();
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

/**
 * Short chime/tone per scan outcome. Returns true only if tones were
 * actually scheduled. Never throws.
 */
export function playScanFeedback(kind: ScanFeedbackKind): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state !== 'running') {
    console.warn(`[scanFeedback] AudioContext still '${ctx.state}' — sound skipped for '${kind}' (no user gesture has unlocked audio yet)`);
    return false;
  }
  try {
    switch (kind) {
      case 'success':
        // Bright ascending two-note chime — document accepted
        tone(ctx, 880, 0, 0.13, 0.1);
        tone(ctx, 1318.5, 0.1, 0.16, 0.1);
        break;
      case 'error':
        // Low soft double-buzz — unknown/invalid/rejected code
        tone(ctx, 196, 0, 0.13, 0.09, 'triangle');
        tone(ctx, 164.8, 0.15, 0.16, 0.09, 'triangle');
        break;
      case 'duplicate':
        // Single quiet muted click — repeated scan, no spam
        tone(ctx, 523.3, 0, 0.05, 0.035, 'triangle');
        break;
    }
    console.debug('[scanFeedback] audio played:', kind);
    return true;
  } catch (err) {
    console.warn('[scanFeedback] audio scheduling failed:', err);
    return false;
  }
}

/**
 * Device vibration per scan outcome. Returns true only if the device
 * accepted the pattern. Notes: iOS Safari has no navigator.vibrate; plain
 * http:// origins (non-secure context) expose no vibrate either; and some
 * browsers reject the call without user activation (vibrate() then returns
 * false) — all reported via console for easy field diagnostics.
 */
export function vibrateScanFeedback(kind: ScanFeedbackKind): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      console.debug('[scanFeedback] navigator.vibrate unsupported (iOS Safari or insecure context) — haptics disabled');
      return false;
    }
    const pattern = kind === 'success' ? 40 : kind === 'error' ? [90, 40, 90] : 15;
    const accepted = navigator.vibrate(pattern);
    if (!accepted) {
      console.warn('[scanFeedback] vibrate() returned false — browser blocked it (user activation or visibility requirement)');
    } else {
      console.debug('[scanFeedback] vibration accepted:', kind);
    }
    return accepted;
  } catch (err) {
    console.warn('[scanFeedback] vibrate() threw:', err);
    return false;
  }
}

/** Convenience: fire both audio and haptic feedback for a scan outcome. */
export function scanFeedback(kind: ScanFeedbackKind): void {
  playScanFeedback(kind);
  vibrateScanFeedback(kind);
}
