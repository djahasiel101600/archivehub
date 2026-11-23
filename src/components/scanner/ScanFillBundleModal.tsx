import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers,
  X,
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  FolderPlus,
  Loader2
} from 'lucide-react';
import { useArchive } from '../../context/ArchiveContext';
import { DocumentItem, DocumentBundle } from '../../types';
import { QrScannerView } from './QrScannerView';
import { SCANNER_TAG_HINT } from '../../utils/scannerConfig';
import { scanFeedback, ensureScanAudioUnlocked } from '../../utils/scanFeedback';

interface ScanFillBundleModalProps {
  isOpen: boolean;
  bundle: DocumentBundle | null;
  onClose: () => void;
}

/**
 * Scan-to-fill dossier assembly: continuously scan document QR tags (camera
 * or manual key-in) to collect records, then attach them all to the target
 * bundle in one call. Documents already belonging to a *different* bundle are
 * skipped with a warning (reassignment must be explicit); repeats and records
 * already inside this bundle are flagged as duplicates.
 */
export const ScanFillBundleModal: React.FC<ScanFillBundleModalProps> = ({ isOpen, bundle, onClose }) => {
  const { lookupByQR, lookupByQRRemote, addDocumentsToBundle } = useArchive();

  const [activeScanTab, setActiveScanTab] = useState<'camera' | 'manual'>('camera');
  const [scannedDocs, setScannedDocs] = useState<DocumentItem[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [scanToast, setScanToast] = useState<{ type: 'success' | 'error' | 'dup'; message: string } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannedIdsRef = useRef<Set<string>>(new Set());
  // Continuous camera decodes must not stack overlapping remote lookups.
  const lookupBusyRef = useRef(false);
  // Fresh collection list every time a (different) bundle is opened
  const bundleIdRef = useRef<string | null>(null);

  useEffect(() => {
    scannedIdsRef.current = new Set(scannedDocs.map(d => d.id));
  }, [scannedDocs]);

  useEffect(() => {
    if (isOpen && bundle && bundleIdRef.current !== bundle.id) {
      bundleIdRef.current = bundle.id;
      setScannedDocs([]);
      setScanToast(null);
      setManualInput('');
      setActiveScanTab('camera');
      setCameraError(null);
      // Modal opens as a direct result of a user click — the last reliable
      // gesture window to unlock Web Audio before camera decodes (which are
      // not gestures) start firing feedback sounds.
      ensureScanAudioUnlocked();
    }
    if (!isOpen) bundleIdRef.current = null;
  }, [isOpen, bundle]);

  const showToast = useCallback((type: 'success' | 'error' | 'dup', message: string) => {
    setScanToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setScanToast(null), 2200);
  }, []);

  const processScannedCode = useCallback(async (code: string) => {
    if (!bundle || lookupBusyRef.current) return;
    let result = lookupByQR(code);
    if (!result) {
      // Tag not in the local cache — resolve it on the server so records
      // registered on other workstations can still be scanned into bundles.
      lookupBusyRef.current = true;
      try {
        result = await lookupByQRRemote(code);
      } finally {
        lookupBusyRef.current = false;
      }
    }
    if (!result) {
      scanFeedback('error');
      showToast('error', `Unknown code: "${code.slice(0, 30)}"`);
      return;
    }
    if (result.type !== 'DOCUMENT') {
      scanFeedback('error');
      showToast('error', `"${code.slice(0, 25)}" is a location/bundle tag, not a document`);
      return;
    }
    const doc = result.data as DocumentItem;
    if (scannedIdsRef.current.has(doc.id) || bundle.documentIds.includes(doc.id)) {
      scanFeedback('duplicate');
      showToast('dup', `#${doc.documentNumber} already ${bundle.documentIds.includes(doc.id) ? 'in this bundle' : 'scanned'}`);
      return;
    }
    if (doc.bundleId && doc.bundleId !== bundle.id) {
      scanFeedback('error');
      showToast('error', `#${doc.documentNumber} belongs to another bundle${doc.bundleNumber ? ` (#${doc.bundleNumber})` : ''} — skipped`);
      return;
    }
    scanFeedback('success');
    setScannedDocs(prev => [...prev, doc]);
    showToast('success', `#${doc.documentNumber} — ${doc.title.slice(0, 40)}`);
  }, [bundle, lookupByQR, lookupByQRRemote, showToast]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualInput.trim();
    if (!code) return;
    processScannedCode(code);
    setManualInput('');
  };

  const handleRemoveDoc = (docId: string) => {
    setScannedDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleFinish = async () => {
    if (!bundle || scannedDocs.length === 0 || isFinishing) return;
    setIsFinishing(true);
    try {
      await addDocumentsToBundle(bundle.id, scannedDocs.map(d => d.id));
      onClose();
    } finally {
      setIsFinishing(false);
    }
  };

  if (!isOpen || !bundle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="card max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="section-title">
                Scan Documents into Bundle
              </h3>
              <p className="meta truncate max-w-[240px]">
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{bundle.bundleNumber}</span>
                {' '}— {bundle.title} ({bundle.documentIds.length} existing)
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 space-y-4">
          {/* Scan Mode Tabs */}
          <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setActiveScanTab('camera'); setScanToast(null); }}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeScanTab === 'camera'
                  ? 'bg-teal-600 text-white'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Camera Scanner
            </button>
            <button
              type="button"
              onClick={() => { setActiveScanTab('manual'); setScanToast(null); }}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeScanTab === 'manual'
                  ? 'bg-teal-600 text-white'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Search className="w-3.5 h-3.5" /> Manual Key-In
            </button>
          </div>

          {/* Camera View */}
          {activeScanTab === 'camera' && !cameraError && (
            <div className="flex flex-col items-center">
              <QrScannerView
                key={cameraRetryKey}
                onDecode={processScannedCode}
                onError={(message) => setCameraError(message)}
                className="w-full max-w-sm h-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 shadow-inner"
              />
              {/* Guidance pills: visually distinct but translucent and outside the
                  video stream, so they never obscure or block any controls. */}
              <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 mt-2 text-center bg-zinc-100/80 dark:bg-zinc-800/60 rounded-lg px-2.5 py-1">
                Point camera at each document QR code — scanning continues automatically
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 text-center bg-zinc-100/60 dark:bg-zinc-800/40 rounded-lg px-2.5 py-1 max-w-sm">
                {SCANNER_TAG_HINT}
              </p>
            </div>
          )}

          {activeScanTab === 'camera' && cameraError && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Camera Unavailable</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">{cameraError}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                  Allow camera access, or use Manual Key-In to type document codes.
                </p>
                <button
                  type="button"
                  onClick={() => { setCameraError(null); setCameraRetryKey(k => k + 1); }}
                  className="btn btn-secondary btn-xs mt-2"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Manual Input */}
          {activeScanTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter document #, QR code, or barcode..."
                className="input flex-1 font-mono"
                autoFocus
              />
              <button type="submit" className="btn btn-primary">
                Add
              </button>
            </form>
          )}

          {/* Scan Toast Notification */}
          {scanToast && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold animate-in slide-in-from-top-1 duration-150 ${
              scanToast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
              scanToast.type === 'dup' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
              'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}>
              {scanToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> :
               scanToast.type === 'dup' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> :
               <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              <span className="truncate">{scanToast.message}</span>
            </div>
          )}

          {/* Scanned Documents List */}
          {scannedDocs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Scanned Documents
                </span>
                <span className="chip rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
                  {scannedDocs.length} item(s)
                </span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {scannedDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                        #{doc.documentNumber}
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-300 ml-2 truncate">{doc.title.slice(0, 40)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(doc.id)}
                      title="Remove from scan list"
                      aria-label="Remove from scan list"
                      className="btn btn-ghost btn-icon btn-xs text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scannedDocs.length === 0 && activeScanTab === 'manual' && (
            <p className="text-[11px] text-zinc-400 text-center">
              Type or paste a document number / QR value and press Add.
            </p>
          )}
        </div>

        {/* Footer — stacked above any scanner overlay so its buttons stay clickable */}
        <div className="relative z-20 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isFinishing}
            className="btn btn-secondary"
          >
            Close Without Saving
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={scannedDocs.length === 0 || isFinishing}
            className="btn btn-primary"
          >
            {isFinishing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...</>
            ) : (
              <><FolderPlus className="w-3.5 h-3.5" /> Add {scannedDocs.length} Document(s) to Bundle</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
