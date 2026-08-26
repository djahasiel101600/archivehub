import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useArchive } from '../../context/ArchiveContext';
import { StatusBadge } from '../common/StatusBadge';
import { LocationPathBreadcrumbs } from '../common/LocationPathBreadcrumbs';
import { 
  Camera, 
  QrCode, 
  Search, 
  X, 
  ArrowRight, 
  AlertTriangle, 
  FileText, 
  MapPin, 
  ArrowRightLeft,
  Layers
} from 'lucide-react';
import { DocumentItem, LocationItem, DocumentBundle } from '../../types';
import { SCANNER_CONFIG, SCANNER_TAG_HINT, suppressScannerConsoleNoise } from '../../utils/scannerConfig';

interface CameraQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument?: (doc: DocumentItem) => void;
  onSelectLocation?: (loc: LocationItem) => void;
  onSelectBundle?: (bundle: DocumentBundle) => void;
}

export const CameraQRScannerModal: React.FC<CameraQRScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectDocument,
  onSelectLocation,
  onSelectBundle
}) => {
  const { lookupByQR, calculatePath, bundles, documents, setActiveTab: navigateToTab } = useArchive();
  const [manualInput, setManualInput] = useState('');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [scanResult, setScanResult] = useState<{
    type: 'DOCUMENT' | 'LOCATION' | 'BUNDLE';
    data: DocumentItem | LocationItem | DocumentBundle;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Only run when the camera view is actually the thing being shown
    if (!(isOpen && activeTab === 'camera' && !scanResult)) return;

    let isCancelled = false;
    let localScanner: Html5QrcodeScanner | null = null;

    const timer = setTimeout(() => {
      if (isCancelled) return;

      const el = document.getElementById('qr-reader');
      if (!el) return; // DOM not ready / already unmounted

      suppressScannerConsoleNoise();
      localScanner = new Html5QrcodeScanner(
        'qr-reader',
        SCANNER_CONFIG,
        /* verbose= */ false
      );

      localScanner.render(
        (decodedText) => {
          handleProcessCode(decodedText);
          localScanner?.clear().catch(() => {});
          setScannerActive(false);
        },
        () => {
          // Ignore background scanning frame errors
        }
      );

      scannerRef.current = localScanner;
      setScannerActive(true);
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);

      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.clear().catch(() => {
          // Scanner may already be mid-teardown; safe to ignore
        });
      }
    };
  }, [isOpen, activeTab, scanResult]);

  if (!isOpen) return null;

  const handleProcessCode = (code: string) => {
    setScanError(null);
    const result = lookupByQR(code);
    if (result) {
      setScanResult(result);
    } else {
      setScanResult(null);
      setScanError(`No document, bundle, or storage location found matching code: "${code}"`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleProcessCode(manualInput);
    }
  };

  const handleSampleScan = (sampleCode: string) => {
    setManualInput(sampleCode);
    handleProcessCode(sampleCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Archive QR & Barcode Scanner
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan physical location tags, boxes, folders, or document QR labels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/30 px-6 pt-2">
          <button
            type="button"
            onClick={() => { setActiveTab('camera'); setScanResult(null); setScanError(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'camera'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Camera className="w-4 h-4" />
            Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('manual'); setScanResult(null); setScanError(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'manual'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Search className="w-4 h-4" />
            Manual Key-In
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'camera' && !scanResult && (
            <div className="flex flex-col items-center justify-center">
              <div id="qr-reader" className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner" />
              <p className="text-xs text-slate-500 mt-3 text-center">
                Position the QR code or Barcode label within the camera viewport
              </p>
              <p className="text-[11px] text-slate-400 mt-1 text-center">
                {SCANNER_TAG_HINT}
              </p>
            </div>
          )}

          {activeTab === 'manual' && !scanResult && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Enter Tag Code, Document #, or Barcode Identifier
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g., DOC-8F29A1, NIA-2026-001245, LOC-BOX-B017"
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white font-medium text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              {/* Preset Sample Quick Buttons */}
              <div>
                <span className="block text-[11px] text-slate-400 uppercase font-semibold tracking-wider mb-2">
                  Try Demo Physical QR Tags:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Doc: NIA-2026-001245', code: 'DOC-NIA-2026-001245' },
                    { label: 'Doc: Dam Blueprint (DOC-8F29A1)', code: 'DOC-8F29A1' },
                    { label: 'Box: Box B-017', code: 'LOC-BOX-B017' },
                    { label: 'Folder: Folder F-2026-003', code: 'LOC-FLD-003' }
                  ].map(sample => (
                    <button
                      key={sample.code}
                      type="button"
                      onClick={() => handleSampleScan(sample.code)}
                      className="px-2.5 py-1 text-xs font-mono bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {scanError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 dark:bg-rose-950/40 dark:border-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">Record Not Recognized</p>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{scanError}</p>
              </div>
            </div>
          )}

          {/* Successful Scan Card Result */}
          {scanResult && (
            <div className="p-5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {scanResult.type === 'DOCUMENT' ? (
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  ) : scanResult.type === 'BUNDLE' ? (
                    <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  ) : (
                    <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                    {scanResult.type === 'DOCUMENT' ? 'Document Record Identified' : scanResult.type === 'BUNDLE' ? 'Bundle Dossier Identified' : 'Physical Storage Location Identified'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setScanResult(null)}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Scan Another Tag
                </button>
              </div>

              {/* Document Result Details */}
              {scanResult.type === 'DOCUMENT' && (() => {
                const doc = scanResult.data as DocumentItem;
                const isCheckedOut = doc.status === 'CHECKED_OUT';
                const homePath = calculatePath(doc.homeLocationId);
                const currentPath = calculatePath(doc.currentLocationId);

                return (
                  <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          #{doc.documentNumber}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                          {doc.title}
                        </h4>
                      </div>
                      <StatusBadge type="status" value={doc.status} />
                    </div>

                    {/* Distinct Home vs Current Location Display */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          🏠 Home Archive Storage Location:
                        </span>
                        <LocationPathBreadcrumbs locationId={doc.homeLocationId} badgeSize="sm" />
                      </div>

                      {isCheckedOut ? (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            Current Custody (Checked Out):
                          </span>
                          <p className="font-semibold text-amber-900 dark:text-amber-200">{doc.custodianName}</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">📍 {currentPath}</p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            📍 Current Physical Position:
                          </span>
                          <LocationPathBreadcrumbs locationId={doc.currentLocationId} badgeSize="sm" />
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onSelectDocument) onSelectDocument(doc);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-medium text-xs rounded-xl hover:bg-indigo-700 shadow-sm transition-colors"
                      >
                        View Record Master Page
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Location Result Details */}
              {scanResult.type === 'LOCATION' && (() => {
                const loc = scanResult.data as LocationItem;
                const path = calculatePath(loc.id);

                return (
                  <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        [{loc.type}] CODE: {loc.code}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base mt-0.5">
                        {loc.name}
                      </h4>
                      {loc.description && (
                        <p className="text-xs text-slate-500 mt-1">{loc.description}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Full Location Tree Path:
                      </span>
                      <p className="text-xs font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                        {path}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onSelectLocation) onSelectLocation(loc);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-xl hover:bg-emerald-700 shadow-sm transition-colors"
                      >
                        Explore Storage Unit
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Bundle Result Details */}
              {scanResult.type === 'BUNDLE' && (() => {
                const bundle = scanResult.data as DocumentBundle;
                const bundleDocs = bundle.documentIds
                  .map(id => documents.find(d => d.id === id))
                  .filter((d): d is DocumentItem => d !== undefined);

                return (
                  <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                          {bundle.bundleNumber}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                          {bundle.title}
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/50">
                        {bundle.status}
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          📦 Bundle Location:
                        </span>
                        {bundle.locationId ? (
                          <LocationPathBreadcrumbs locationId={bundle.locationId} badgeSize="sm" />
                        ) : (
                          <span className="italic text-slate-400">No physical location assigned</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          📄 Contains {bundle.documentIds.length} document(s):
                        </span>
                        <div className="max-h-28 overflow-y-auto space-y-1">
                          {bundleDocs.slice(0, 5).map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="font-mono text-[10px] text-indigo-500 font-bold">{doc.documentNumber}</span>
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate flex-1">{doc.title}</span>
                            </div>
                          ))}
                          {bundleDocs.length > 5 && (
                            <p className="text-[10px] text-slate-400 pl-1">+{bundleDocs.length - 5} more documents</p>
                          )}
                          {bundleDocs.length === 0 && (
                            <p className="text-[11px] text-slate-400 italic">No documents found in this bundle</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {bundle.tags && bundle.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {bundle.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigateToTab('bundles');
                          if (onSelectBundle) onSelectBundle(bundle);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white font-medium text-xs rounded-xl hover:bg-violet-700 shadow-sm transition-colors"
                      >
                        View in Bundle Manager
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
