import React, { useEffect, useRef } from 'react';
import QrScanner from '@agicash/qr-scanner';
import {
  SCANNER_MAX_SCANS_PER_SECOND,
  SCANNER_REGION_FRACTION,
  SCANNER_CAMERA_RESOLUTION,
  createScanDedupe
} from '../../utils/scannerConfig';

interface QrScannerViewProps {
  /** Called with the decoded tag value. Fires continuously while mounted. */
  onDecode: (code: string) => void;
  /**
   * Swallow repeat decodes of the identical code within this window (ms),
   * keeping continuous-scan flows quiet while the same tag stays in frame.
   * Pass 0 to disable.
   */
  dedupeMs?: number;
  /** Centered square scan crop as a fraction of the smaller video dimension. */
  regionFraction?: number;
  className?: string;
}

// Self-hosted ZXing-C++ WASM decoder (public/zxing). Must be configured
// before the first scanner instance creates its decode worker.
let wasmConfigured = false;
function ensureWasmConfigured(): void {
  if (wasmConfigured) return;
  wasmConfigured = true;
  QrScanner.configureWasm({
    locateFile: (filename: string) => `/zxing/${filename}`
  });
}

/**
 * Camera scanner view backed by @agicash/qr-scanner (ZXing-C++ WASM).
 * Tuned for the small physical archive tags: high-resolution camera frames,
 * a tight centered crop, elevated decode rate, inverted-code tolerance, and
 * scan-region / code-outline highlighting. Decoding runs in a Web Worker so
 * the UI stays responsive.
 */
export const QrScannerView: React.FC<QrScannerViewProps> = ({
  onDecode,
  dedupeMs = 1500,
  regionFraction = SCANNER_REGION_FRACTION,
  className
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Refs keep the scanner callbacks fresh without re-creating the camera session
  const onDecodeRef = useRef(onDecode);
  const dedupeMsRef = useRef(dedupeMs);
  const regionFractionRef = useRef(regionFraction);

  useEffect(() => { onDecodeRef.current = onDecode; }, [onDecode]);
  useEffect(() => { dedupeMsRef.current = dedupeMs; }, [dedupeMs]);
  useEffect(() => { regionFractionRef.current = regionFraction; }, [regionFraction]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    ensureWasmConfigured();

    let scanner: QrScanner | null = null;
    let cancelled = false;
    const dedupe = createScanDedupe();

    scanner = new QrScanner(
      video,
      (result) => {
        const code = result.data;
        if (dedupeMsRef.current > 0 && !dedupe(code)) return;
        onDecodeRef.current(code);
      },
      {
        maxScansPerSecond: SCANNER_MAX_SCANS_PER_SECOND,
        cameraResolution: SCANNER_CAMERA_RESOLUTION,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: 'environment',
        // Tight centered crop so small tags fill the detection area
        calculateScanRegion: (v) => {
          const size = Math.max(
            160,
            Math.round(Math.min(v.videoWidth || 480, v.videoHeight || 480) * regionFractionRef.current)
          );
          return {
            x: Math.max(0, Math.round(((v.videoWidth || 480) - size) / 2)),
            y: Math.max(0, Math.round(((v.videoHeight || 480) - size) / 2)),
            width: size,
            height: size
          };
        },
        // Per-frame decode misses are expected while hunting — keep it silent
        onDecodeError: () => {}
      }
    );

    scanner.start().then(() => {
      if (cancelled || !scanner) return;
      // Also decode inverted (light-on-dark) labels for contrast tolerance.
      // Must run after start() — the decode worker only exists by then.
      scanner.setInversionMode('both');
    }).catch((err) => {
      if (!cancelled) {
        console.warn('[QrScannerView] Camera failed to start:', err?.message || err);
      }
    });

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.destroy();
        scanner = null;
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      className={className || 'w-full h-auto block'}
    />
  );
};
