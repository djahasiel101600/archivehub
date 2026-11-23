import React, { useState, useEffect, useRef } from 'react';
import { QrScannerView } from './QrScannerView';
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
import { SCANNER_TAG_HINT } from '../../utils/scannerConfig';
import { scanFeedback, ensureScanAudioUnlocked } from '../../utils/scanFeedback';

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
  const { lookupByQR, lookupByQRRemote, calculatePath, bundles, documents, setActiveTab: navigateToTab } = useArchive();
  const [manualInput, setManualInput] = useState('');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [scanResult, setScanResult] = useState<{
    type: 'DOCUMENT' | 'LOCATION' | 'BUNDLE';
    data: DocumentItem | LocationItem | DocumentBundle;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const [lookingUp, setLookingUp] = useState(false);
  // Continuous camera decodes must not stack overlapping remote lookups.
  const lookupBusyRef = useRef(false);

  // Modal opens from a user click — unlock Web Audio inside that gesture
  // window so later camera decodes (not gestures) can play feedback sounds.
  useEffect(() => {
    if (isOpen) {
      ensureScanAudioUnlocked();
      setScanError(null);
      setCameraError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcessCode = async (code: string) => {
    if (lookupBusyRef.current) return;
    setScanError(null);
    const local = lookupByQR(code);
    if (local) {
      scanFeedback('success');
      setScanResult(local);
      return;
    }
    // Not in the local cache — resolve via the server so tags registered on
    // other workstations (or filtered out of this user's list) still scan.
    lookupBusyRef.current = true;
    setLookingUp(true);
    try {
      const remote = await lookupByQRRemote(code);
      if (remote) {
        scanFeedback('success');
        setScanResult(remote);
      } else {
        scanFeedback('error');
        setScanResult(null);
        setScanError(`No document, bundle, or storage location found matching code: "${code}"`);
      }
    } finally {
      lookupBusyRef.current = false;
      setLookingUp(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="card max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] my-auto" role="dialog" aria-modal="true">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-lg">
              <QrCode className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="section-title">
                Archive QR & Barcode Scanner
              </h3>
              <p className="meta">
                Scan physical location tags, boxes, folders, or document QR labels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-800/30 px-5 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('camera'); setScanResult(null); setScanError(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'camera'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400 bg-white dark:bg-zinc-900 rounded-t-lg'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
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
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400 bg-white dark:bg-zinc-900 rounded-t-lg'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
            }`}
          >
            <Search className="w-4 h-4" />
            Manual Key-In
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'camera' && !scanResult && !cameraError && (
            <div className="flex flex-col items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner bg-black">
                <QrScannerView
                  key={cameraRetryKey}
                  onDecode={handleProcessCode}
                  onError={(message) => setCameraError(message)}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-3 text-center">
                {lookingUp ? 'Looking up code on the server…' : 'Position the QR code or Barcode label within the camera viewport'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 text-center">
                {SCANNER_TAG_HINT}
              </p>
            </div>
          )}

          {activeTab === 'camera' && !scanResult && cameraError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 dark:bg-amber-950/40 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Camera Unavailable</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{cameraError}</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Allow camera access in your browser settings, or switch to the Manual Key-In tab to type the tag code.
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

          {activeTab === 'manual' && !scanResult && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="label">
                  Enter Tag Code, Document #, or Barcode Identifier
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g., DOC-8F29A1, ENG-ARCH-0001, LOC-BOX-B017"
                    className="input flex-1"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              {/* Preset Sample Quick Buttons */}
              <div>
                <span className="block text-[11px] text-zinc-400 uppercase font-semibold tracking-wider mb-2">
                  Try Demo Physical QR Tags:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Doc: ENG-ARCH-0001', code: 'DOC-ENG-ARCH-0001' },
                    { label: 'Doc: Dam Blueprint (DOC-8F29A1)', code: 'DOC-8F29A1' },
                    { label: 'Box: Box B-017', code: 'LOC-BOX-B017' },
                    { label: 'Folder: Folder F-2026-003', code: 'LOC-FLD-003' }
                  ].map(sample => (
                    <button
                      key={sample.code}
                      type="button"
                      onClick={() => handleSampleScan(sample.code)}
                      className="btn btn-secondary btn-xs font-mono"
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
            <div className="p-5 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {scanResult.type === 'DOCUMENT' ? (
                    <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  ) : scanResult.type === 'BUNDLE' ? (
                    <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  ) : (
                    <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="chip uppercase tracking-wider text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60">
                    {scanResult.type === 'DOCUMENT' ? 'Document Record Identified' : scanResult.type === 'BUNDLE' ? 'Bundle Dossier Identified' : 'Physical Storage Location Identified'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setScanResult(null)}
                  className="btn btn-ghost btn-xs text-teal-600 dark:text-teal-400"
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
                  <div className="card space-y-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                          #{doc.documentNumber}
                        </span>
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mt-0.5">
                          {doc.title}
                        </h4>
                      </div>
                      <StatusBadge type="status" value={doc.status} />
                    </div>

                    {/* Distinct Home vs Current Location Display */}
                    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
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
                          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                            📍 Current Physical Position:
                          </span>
                          <LocationPathBreadcrumbs locationId={doc.currentLocationId} badgeSize="sm" />
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onSelectDocument) onSelectDocument(doc);
                        }}
                        className="btn btn-primary btn-sm"
                      >
                        View Record Master Page
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
                  <div className="card space-y-3 p-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        [{loc.type}] CODE: {loc.code}
                      </span>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base mt-0.5">
                        {loc.name}
                      </h4>
                      {loc.description && (
                        <p className="text-xs text-zinc-500 mt-1">{loc.description}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                        Full Location Tree Path:
                      </span>
                      <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 p-2 rounded-lg">
                        {path}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onSelectLocation) onSelectLocation(loc);
                        }}
                        className="btn btn-sm text-white bg-emerald-600 hover:bg-emerald-700"
                      >
                        Explore Storage Unit
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
                  <div className="card space-y-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                          {bundle.bundleNumber}
                        </span>
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mt-0.5">
                          {bundle.title}
                        </h4>
                      </div>
                      <span className="chip rounded-full bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/50">
                        {bundle.status}
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                          📦 Bundle Location:
                        </span>
                        {bundle.locationId ? (
                          <LocationPathBreadcrumbs locationId={bundle.locationId} badgeSize="sm" />
                        ) : (
                          <span className="italic text-zinc-400">No physical location assigned</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                          📄 Contains {bundle.documentIds.length} document(s):
                        </span>
                        <div className="max-h-28 overflow-y-auto space-y-1">
                          {bundleDocs.slice(0, 5).map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                              <FileText className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                              <span className="font-mono text-[10px] text-teal-500 font-bold">{doc.documentNumber}</span>
                              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate flex-1">{doc.title}</span>
                            </div>
                          ))}
                          {bundleDocs.length > 5 && (
                            <p className="text-[10px] text-zinc-400 pl-1">+{bundleDocs.length - 5} more documents</p>
                          )}
                          {bundleDocs.length === 0 && (
                            <p className="text-[11px] text-zinc-400 italic">No documents found in this bundle</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {bundle.tags && bundle.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {bundle.tags.map(tag => (
                          <span key={tag} className="chip bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigateToTab('bundles');
                          if (onSelectBundle) onSelectBundle(bundle);
                        }}
                        className="btn btn-sm text-white bg-violet-600 hover:bg-violet-700"
                      >
                        View in Bundle Manager
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
