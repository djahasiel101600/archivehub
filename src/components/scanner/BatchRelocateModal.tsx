import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useArchive } from '../../context/ArchiveContext';
import { LocationPathBreadcrumbs } from '../common/LocationPathBreadcrumbs';
import {
  Truck,
  X,
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MapPin,
  ArrowRight,
  Trash2,
  Loader2,
  ScanLine
} from 'lucide-react';
import { DocumentItem, LocationItem } from '../../types';

interface BatchRelocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-populated documents (e.g. from a bundle); skips scan step */
  preselectedDocs?: DocumentItem[];
  /** Bundle ID — when set, the bundle's location is also updated after relocation */
  bundleId?: string;
}

type Step = 'scan' | 'confirm' | 'done';

export const BatchRelocateModal: React.FC<BatchRelocateModalProps> = ({
  isOpen,
  onClose,
  preselectedDocs,
  bundleId
}) => {
  const { lookupByQR, calculatePath, locations, documents, batchMoveDocuments, addBundle, updateBundle, departments } = useArchive();
  const isBundleMode = !!bundleId && !!preselectedDocs && preselectedDocs.length > 0;

  const [step, setStep] = useState<Step>(isBundleMode ? 'confirm' : 'scan');
  const [scannedDocs, setScannedDocs] = useState<DocumentItem[]>(isBundleMode ? preselectedDocs : []);
  const [activeScanTab, setActiveScanTab] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [scanToast, setScanToast] = useState<{ type: 'success' | 'error' | 'dup'; message: string } | null>(null);
  const [scannerActive, setScannerActive] = useState(false);

  // Confirm step state
  const [destinationId, setDestinationId] = useState(locations[0]?.id || '');
  const [reason, setReason] = useState(isBundleMode ? 'Bundle relocation transfer' : 'Batch storage relocation transfer');
  const [wantBundle, setWantBundle] = useState(false);
  const [bundleTitle, setBundleTitle] = useState('');
  const [bundleNumber, setBundleNumber] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  // Destination QR scan state (confirm step)
  const [showDestScanner, setShowDestScanner] = useState(false);
  const [destScanError, setDestScanError] = useState('');

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const destScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref of scanned doc IDs to avoid stale closure in scanner callback
  const scannedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    scannedIdsRef.current = new Set(scannedDocs.map(d => d.id));
  }, [scannedDocs]);

  const showToast = useCallback((type: 'success' | 'error' | 'dup', message: string) => {
    setScanToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setScanToast(null), 1800);
  }, []);

  const processScannedCode = useCallback((code: string) => {
    const result = lookupByQR(code);
    if (!result) {
      showToast('error', `Unknown code: "${code.slice(0, 30)}"`);
      return;
    }
    if (result.type !== 'DOCUMENT') {
      showToast('error', `"${code.slice(0, 25)}" is a location, not a document`);
      return;
    }
    const doc = result.data as DocumentItem;
    if (scannedIdsRef.current.has(doc.id)) {
      showToast('dup', `#${doc.documentNumber} already scanned`);
      return;
    }
    setScannedDocs(prev => [...prev, doc]);
    showToast('success', `#${doc.documentNumber} — ${doc.title.slice(0, 40)}`);
  }, [lookupByQR, showToast]);

  // Camera scanner lifecycle
  useEffect(() => {
    if (!(isOpen && step === 'scan' && activeScanTab === 'camera')) return;

    let isCancelled = false;
    let localScanner: Html5QrcodeScanner | null = null;

    const timer = setTimeout(() => {
      if (isCancelled) return;
      const el = document.getElementById('batch-qr-reader');
      if (!el) return;

      localScanner = new Html5QrcodeScanner(
        'batch-qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
        false
      );

      localScanner.render(
        (decodedText) => {
          processScannedCode(decodedText);
          // Don't clear — let it keep scanning continuously
        },
        () => { /* ignore frame errors */ }
      );

      scannerRef.current = localScanner;
      setScannerActive(true);
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) s.clear().catch(() => {});
      setScannerActive(false);
    };
  }, [isOpen, step, activeScanTab, processScannedCode]);

  // Destination location scan: resolves the scanned code and requires a LOCATION tag
  const processDestScannedCode = useCallback((code: string) => {
    const result = lookupByQR(code);
    if (!result) {
      setDestScanError(`Unknown code: "${code.slice(0, 30)}"`);
      return;
    }
    if (result.type !== 'LOCATION') {
      setDestScanError(`Scanned code is a ${result.type.toLowerCase()}, not a storage location.`);
      return;
    }
    const loc = result.data as LocationItem;
    setDestinationId(loc.id);
    setDestScanError('');
    setShowDestScanner(false);
  }, [lookupByQR]);

  // Destination scanner lifecycle (confirm step only)
  useEffect(() => {
    if (!(isOpen && step === 'confirm' && showDestScanner)) return;

    let isCancelled = false;

    const timer = setTimeout(() => {
      if (isCancelled) return;
      const el = document.getElementById('dest-qr-reader');
      if (!el) return;

      const localScanner = new Html5QrcodeScanner(
        'dest-qr-reader',
        { fps: 10, qrbox: { width: 220, height: 220 }, rememberLastUsedCamera: true },
        false
      );

      localScanner.render(
        (decodedText) => processDestScannedCode(decodedText),
        () => { /* ignore frame errors */ }
      );

      destScannerRef.current = localScanner;
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      const s = destScannerRef.current;
      destScannerRef.current = null;
      if (s) s.clear().catch(() => {});
    };
  }, [isOpen, step, showDestScanner, processDestScannedCode]);

  // Cleanup toast timer
  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      processScannedCode(manualInput.trim());
      setManualInput('');
    }
  };

  const handleRemoveDoc = (docId: string) => {
    setScannedDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleProceedToConfirm = () => {
    // Stop the camera scanner before transitioning
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) s.clear().catch(() => {});
    setScannerActive(false);
    setStep('confirm');
  };

  const handleBackToScan = () => {
    setStep('scan');
  };

  const handleExecute = async () => {
    if (!destinationId || scannedDocs.length === 0) return;
    setIsExecuting(true);
    try {
      const docIds = scannedDocs.map(d => d.id);
      await batchMoveDocuments(docIds, destinationId, reason);

      if (wantBundle && bundleTitle.trim() && !isBundleMode) {
        const deptObj = departments[0];
        await addBundle({
          bundleNumber: bundleNumber.trim() || `BNDL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          title: bundleTitle.trim(),
          description: `Auto-created during batch relocation of ${docIds.length} document(s).`,
          departmentId: deptObj?.id || '',
          departmentName: deptObj?.name || 'General Department',
          locationId: destinationId,
          locationPath: calculatePath(destinationId),
          documentIds: docIds,
          status: 'ACTIVE',
          tags: ['Batch Relocation', 'Auto-Bundle']
        });
      }

      // If this was a bundle relocation, update the bundle's location too
      if (bundleId) {
        await updateBundle(bundleId, {
          locationId: destinationId,
          locationPath: calculatePath(destinationId)
        });
      }

      setResultMessage(`${scannedDocs.length} document(s) relocated to ${calculatePath(destinationId)}`);
      setStep('done');
    } catch (err) {
      setResultMessage('Relocation failed. Please try again.');
      setStep('done');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setScannedDocs([]);
    setStep('scan');
    setScanToast(null);
    setManualInput('');
    setWantBundle(false);
    setBundleTitle('');
    setBundleNumber('');
    setResultMessage('');
  };

  const handleClose = () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) s.clear().catch(() => {});
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                {isBundleMode ? 'Relocate Bundle' : 'Batch Relocate Documents'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isBundleMode
                  ? `Moving ${preselectedDocs.length} document(s) to a new storage location`
                  : 'Scan QR codes to move multiple records to a new storage location'
                }
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          {(['scan', 'confirm', 'done'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className={`flex-1 h-0.5 rounded ${step === s || (s === 'confirm' && step === 'done') ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                step === s ? 'text-emerald-600 dark:text-emerald-400' :
                (s === 'scan' && step !== 'scan') || (s === 'confirm' && step === 'done') ? 'text-emerald-500' :
                'text-slate-400'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                  step === s ? 'bg-emerald-600 text-white border-emerald-600' :
                  (s === 'scan' && step !== 'scan') || (s === 'confirm' && step === 'done') ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 border-emerald-300' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                }`}>
                  {i + 1}
                </div>
                <span className="hidden sm:inline">{s === 'scan' ? 'Scan' : s === 'confirm' ? 'Confirm' : 'Done'}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ===== STEP 1: SCAN ===== */}
          {step === 'scan' && (
            <div className="p-5 space-y-4">
              {/* Scan Mode Tabs */}
              <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setActiveScanTab('camera'); setScanToast(null); }}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                    activeScanTab === 'camera'
                      ? 'bg-emerald-600 text-white'
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
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" /> Manual Key-In
                </button>
              </div>

              {/* Camera View */}
              {activeScanTab === 'camera' && (
                <div className="flex flex-col items-center">
                  <div id="batch-qr-reader" className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner" />
                  <p className="text-[11px] text-slate-500 mt-2 text-center">
                    Point camera at each document QR code — scanning continues automatically
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
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 shadow-sm">
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
                   <X className="w-4 h-4 flex-shrink-0" />}
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
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      {scannedDocs.length} item(s)
                    </span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {scannedDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                            #{doc.documentNumber}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 ml-2 truncate">{doc.title.slice(0, 40)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(doc.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg flex-shrink-0"
                          title="Remove from batch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {scannedDocs.length === 0 && !scanToast && (
                <div className="text-center py-6 text-xs text-slate-400">
                  <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p>No documents scanned yet.</p>
                  <p className="text-[10px] mt-1">Scan QR codes to build your relocation batch.</p>
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 2: CONFIRM ===== */}
          {step === 'confirm' && (
            <div className="p-5 space-y-4">
              {/* Batch Summary */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Batch Ready — {scannedDocs.length} Document(s)
                  </span>
                  <button type="button" onClick={handleBackToScan} className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                    ← Back to Scanner
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {scannedDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between text-[11px] bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 border border-emerald-200/60 dark:border-emerald-800/40">
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">#{doc.documentNumber}</span>
                        <span className="text-slate-600 dark:text-slate-300 ml-1.5">{doc.title.slice(0, 35)}</span>
                      </div>
                      <button type="button" onClick={() => handleRemoveDoc(doc.id)} className="p-0.5 text-slate-400 hover:text-rose-500 ml-2 flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination Location */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Destination Storage Location *
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowDestScanner(v => !v); setDestScanError(''); }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                      showDestScanner
                        ? 'text-white bg-emerald-600 border-emerald-600 hover:bg-emerald-700'
                        : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    {showDestScanner ? 'Close Scanner' : 'Scan Location QR'}
                  </button>
                </div>

                {showDestScanner && (
                  <div className="mb-2 p-2 bg-slate-900 rounded-xl border border-slate-700">
                    <div id="dest-qr-reader" className="rounded-lg overflow-hidden" />
                    <p className="text-[10px] text-slate-300 mt-1.5 text-center">
                      Scan the QR tag of the destination storage location
                    </p>
                    {destScanError && (
                      <p className="text-[10px] text-red-400 font-semibold mt-1 text-center flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {destScanError}
                      </p>
                    )}
                  </div>
                )}

                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-mono"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                    </option>
                  ))}
                </select>
                {destinationId && (
                  <div className="mt-1.5 space-y-1">
                    <LocationPathBreadcrumbs locationId={destinationId} badgeSize="sm" />
                    {(() => {
                      const destLoc = locations.find(l => l.id === destinationId);
                      return destLoc?.latitude != null && destLoc.longitude != null ? (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          GPS: {destLoc.latitude.toFixed(5)}, {destLoc.longitude.toFixed(5)}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                  Reason for Transfer
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Moving to off-site storage facility"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs"
                />
              </div>

              {/* Optional Bundle — hidden when already relocating a bundle */}
              {!isBundleMode && (
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={wantBundle}
                    onChange={(e) => setWantBundle(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span>Also bundle these documents into a dossier</span>
                </label>
                {wantBundle && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      value={bundleNumber}
                      onChange={(e) => setBundleNumber(e.target.value)}
                      placeholder="Bundle # (auto if blank)"
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] font-mono outline-none"
                    />
                    <input
                      type="text"
                      value={bundleTitle}
                      onChange={(e) => setBundleTitle(e.target.value)}
                      placeholder="Dossier title *"
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] outline-none"
                    />
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* ===== STEP 3: DONE ===== */}
          {step === 'done' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">Relocation Complete</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{resultMessage}</p>
              </div>
              <p className="text-[11px] text-slate-400">
                Each document now has a RELOCATION entry in the audit trail.
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-2 flex-shrink-0">
          {step === 'scan' && (
            <>
              <button type="button" onClick={handleClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-medium">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirm}
                disabled={scannedDocs.length === 0}
                className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Proceed to Relocate ({scannedDocs.length})</span>
              </button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <button type="button" onClick={handleBackToScan} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-medium">
                ← Scan More
              </button>
              <button
                type="button"
                onClick={handleExecute}
                disabled={isExecuting || !destinationId || scannedDocs.length === 0 || (wantBundle && !bundleTitle.trim())}
                className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                {isExecuting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Relocating...</span></>
                ) : (
                  <><Truck className="w-3.5 h-3.5" /><span>Relocate {scannedDocs.length} Document(s)</span></>
                )}
              </button>
            </>
          )}
          {step === 'done' && (
            <button type="button" onClick={handleClose} className="w-full px-5 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-md">
              Done — Close
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
