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
  const { lookupByQR, addDocumentsToBundle } = useArchive();

  const [activeScanTab, setActiveScanTab] = useState<'camera' | 'manual'>('camera');
  const [scannedDocs, setScannedDocs] = useState<DocumentItem[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [scanToast, setScanToast] = useState<{ type: 'success' | 'error' | 'dup'; message: string } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannedIdsRef = useRef<Set<string>>(new Set());
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
    }
    if (!isOpen) bundleIdRef.current = null;
  }, [isOpen, bundle]);

  const showToast = useCallback((type: 'success' | 'error' | 'dup', message: string) => {
    setScanToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setScanToast(null), 2200);
  }, []);

  const processScannedCode = useCallback((code: string) => {
    if (!bundle) return;
    const result = lookupByQR(code);
    if (!result) {
      showToast('error', `Unknown code: "${code.slice(0, 30)}"`);
      return;
    }
    if (result.type !== 'DOCUMENT') {
      showToast('error', `"${code.slice(0, 25)}" is a location/bundle tag, not a document`);
      return;
    }
    const doc = result.data as DocumentItem;
    if (scannedIdsRef.current.has(doc.id) || bundle.documentIds.includes(doc.id)) {
      showToast('dup', `#${doc.documentNumber} already ${bundle.documentIds.includes(doc.id) ? 'in this bundle' : 'scanned'}`);
      return;
    }
    if (doc.bundleId && doc.bundleId !== bundle.id) {
      showToast('error', `#${doc.documentNumber} belongs to another bundle${doc.bundleNumber ? ` (#${doc.bundleNumber})` : ''} — skipped`);
      return;
    }
    setScannedDocs(prev => [...prev, doc]);
    showToast('success', `#${doc.documentNumber} — ${doc.title.slice(0, 40)}`);
  }, [bundle, lookupByQR, showToast]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                Scan Documents into Bundle
              </h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{bundle.bundleNumber}</span>
                {' '}— {bundle.title} ({bundle.documentIds.length} existing)
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Scan Mode Tabs */}
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setActiveScanTab('camera'); setScanToast(null); }}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeScanTab === 'camera'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Camera Scanner
            </button>
            <button
              type="button"
              onClick={() => { setActiveScanTab('manual'); setScanToast(null); }}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeScanTab === 'manual'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Search className="w-3.5 h-3.5" /> Manual Key-In
            </button>
          </div>

          {/* Camera View */}
          {activeScanTab === 'camera' && (
            <div className="flex flex-col items-center">
              <QrScannerView
                onDecode={processScannedCode}
                className="w-full max-w-sm h-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-inner"
              />
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Point camera at each document QR code — scanning continues automatically
              </p>
              <p className="text-[11px] text-slate-400 mt-1 text-center">
                {SCANNER_TAG_HINT}
              </p>
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
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                autoFocus
              />
              <button type="submit" className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 shadow-sm">
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Scanned Documents
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  {scannedDocs.length} item(s)
                </span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {scannedDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                        #{doc.documentNumber}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 ml-2 truncate">{doc.title.slice(0, 40)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(doc.id)}
                      title="Remove from scan list"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scannedDocs.length === 0 && activeScanTab === 'manual' && (
            <p className="text-[11px] text-slate-400 text-center">
              Type or paste a document number / QR value and press Add.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isFinishing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Close Without Saving
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={scannedDocs.length === 0 || isFinishing}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 transition-colors"
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
