/**
 * Shared camera scanner tuning for the small ~1 cm x 1.5 cm QR/barcode tags
 * printed on physical archive labels. Scanning is powered by
 * @agicash/qr-scanner (ZXing-C++ WASM), which decodes dense/small codes far
 * more reliably than html5-qrcode. These constants are consumed by the
 * QrScannerView wrapper component.
 */

/** Max decode attempts per second — higher = faster lock-on for small tags. */
export const SCANNER_MAX_SCANS_PER_SECOND = 15;

/**
 * Centered square scan crop, as a fraction of the video's smaller dimension.
 * A tighter crop lets a small tag fill the detection area without precise
 * distance alignment.
 */
export const SCANNER_REGION_FRACTION = 0.6;

/** Camera constraints tuned for small-tag readability (high-res frames). */
export const SCANNER_CAMERA_RESOLUTION = {
  width: { ideal: 1920 } as number | { ideal: number },
  height: { ideal: 1080 } as number | { ideal: number }
};

/** On-screen guidance for reliably reading the small physical tags. */
export const SCANNER_TAG_HINT =
  'Hold ~15–20 cm from the tag under even lighting — avoid shadows and glare on the label.';

/**
 * Continuous-scan dedupe window: with the scanner left active after each
 * decode, the same tag keeps re-decoding every frame. Ignore identical codes
 * for this window so repeated sweeps of one tag do not spam toasts or
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
