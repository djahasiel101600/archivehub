import { Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Shared camera scanner tuning for the small 1.5 cm x 1.5 cm QR/barcode tags
 * printed on physical archive labels. A tighter crop lets the tag fill the
 * detection area without precise distance alignment, a higher frame rate
 * shortens the gap between decode attempts, and enabling both QR and common
 * barcode symbologies gives a fallback path when a tiny QR matrix fails.
 */
export const SCANNER_CONFIG = {
  fps: 15,
  qrbox: { width: 180, height: 180 },
  rememberLastUsedCamera: true,
  formatsToSupport: [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.DATA_MATRIX
  ]
};

/** On-screen guidance for reliably reading the small physical tags. */
export const SCANNER_TAG_HINT =
  'Hold ~15–20 cm from the tag under even lighting — avoid shadows and glare on the label.';

let noiseSuppressed = false;

/**
 * Silences non-critical frame-decode noise that html5-qrcode emits via
 * console.warn even in non-verbose mode, keeping the console and UI
 * responsive while the camera hunts for a small tag.
 */
export function suppressScannerConsoleNoise(): void {
  if (noiseSuppressed) return;
  noiseSuppressed = true;
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && /QR Code|html5-qrcode|QR code parse error|Unable to decode/i.test(first)) {
      return;
    }
    originalWarn(...args);
  };
}

/**
 * Continuous-scan dedupe: with the scanner left active after each decode,
 * the same tag keeps re-decoding every frame. Ignore identical codes for a
 * short window so repeated sweeps of one tag do not spam toasts or
 * re-trigger resolution, while adjacent different tags still resolve fast.
 */
export function createScanDedupe(windowMs = 1500): (code: string) => boolean {
  let lastCode = '';
  let lastAt = 0;
  return (code: string) => {
    const now = Date.now();
    if (code === lastCode && now - lastAt < windowMs) {
      return false;
    }
    lastCode = code;
    lastAt = now;
    return true;
  };
}
