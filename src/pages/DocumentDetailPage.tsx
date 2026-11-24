import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QrScannerView } from '../components/scanner/QrScannerView';
import { useArchive } from '../context/ArchiveContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { QRBarcodeModal } from '../components/common/QRBarcodeModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EditDocumentModal } from '../components/documents/EditDocumentModal';
import { 
  FileText, 
  ArrowLeft, 
  QrCode, 
  ArrowRightLeft, 
  MapPin, 
  Calendar, 
  Building2, 
  ShieldCheck, 
  HardDrive, 
  Clock, 
  User as UserIcon, 
  History, 
  AlertTriangle,
  Download,
  Upload,
  CheckCircle2,
  FileCheck,
  RotateCcw,
  Tag,
  Edit,
  SlidersHorizontal,
  Trash2,
  X,
  Layers,
  ScanLine
} from 'lucide-react';
import { DocumentCondition, LocationItem } from '../types';
import { SCANNER_TAG_HINT } from '../utils/scannerConfig';
import { scanFeedback, ensureScanAudioUnlocked } from '../utils/scanFeedback';

interface DocumentDetailPageProps {
  documentId: string;
  onBack: () => void;
  onNavigateLocation: (locationId: string) => void;
}

export const DocumentDetailPage: React.FC<DocumentDetailPageProps> = ({
  documentId,
  onBack,
  onNavigateLocation
}) => {
  const { 
    documents, 
    locations, 
    movements, 
    checkouts, 
    auditLogs, 
    currentUser,
    bundles,
    moveDocument, 
    requestCheckout,
    processCheckInReturn,
    deleteDocument,
    calculatePath,
    lookupByQR,
    lookupByQRRemote,
    addNotification
  } = useArchive();

  const [activeTab, setActiveTab] = useState<'movements' | 'checkouts' | 'audit'>('movements');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
  // Relocation Modal State
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetLocationId, setTargetLocationId] = useState(locations[0]?.id || '');
  const [moveReason, setMoveReason] = useState('');

  // Destination QR scan state (relocation modal)
  const [showDestScanner, setShowDestScanner] = useState(false);
  const [destScanError, setDestScanError] = useState('');
  // Continuous camera decodes must not stack overlapping remote lookups.
  const destLookupBusyRef = useRef(false);

  // Destination scanner opens from a user click — unlock Web Audio inside
  // that gesture window so camera decodes can play feedback sounds.
  useEffect(() => {
    if (showDestScanner) ensureScanAudioUnlocked();
  }, [showDestScanner]);

  useEffect(() => {
    setSelectedPhotoIndex(0);
  }, [documentId]);

  const processDestScannedCode = useCallback(async (code: string) => {
    if (destLookupBusyRef.current) return;
    let result = lookupByQR(code);
    if (!result) {
      // Tag not in the local cache — resolve it on the server.
      destLookupBusyRef.current = true;
      try {
        result = await lookupByQRRemote(code);
      } finally {
        destLookupBusyRef.current = false;
      }
    }
    if (!result) {
      scanFeedback('error');
      setDestScanError(`Unknown code: "${code.slice(0, 30)}"`);
      return;
    }
    if (result.type !== 'LOCATION') {
      scanFeedback('error');
      setDestScanError(`Scanned code is a ${result.type.toLowerCase()}, not a storage location.`);
      return;
    }
    const loc = result.data as LocationItem;
    scanFeedback('success');
    setTargetLocationId(loc.id);
    setDestScanError('');
    setShowDestScanner(false);
  }, [lookupByQR, lookupByQRRemote]);

  // Request Borrowing Modal
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [borrowPurpose, setBorrowPurpose] = useState('');
  const [borrowDueDate, setBorrowDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Return Processing Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnCondition, setReturnCondition] = useState<DocumentCondition>('EXCELLENT');
  const [returnLocationId, setReturnLocationId] = useState('');

  const doc = documents.find(d => d.id === documentId);

  if (!doc) {
    return (
      <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Document Record Not Found</h3>
        <p className="text-xs text-zinc-500 mt-1">The requested document ID does not exist or has been removed.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-zinc-800 text-white text-xs font-semibold rounded-xl"
        >
          ← Return to Catalogue
        </button>
      </div>
    );
  }

  const isCheckedOut = doc.status === 'CHECKED_OUT';
  const activeCheckout = checkouts.find(c => c.documentId === doc.id && (c.status === 'CHECKED_OUT' || c.status === 'OVERDUE'));

  const homePath = calculatePath(doc.homeLocationId);
  const currentPath = calculatePath(doc.currentLocationId);

  const docMovements = movements.filter(m => m.documentId === doc.id);
  const docCheckouts = checkouts.filter(c => c.documentId === doc.id);
  const docAuditLogs = auditLogs.filter(a => a.entityId === doc.id);

  const handleMoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLocationId) return;
    moveDocument(doc.id, targetLocationId, moveReason.trim() || 'Physical Location Transfer');
    setShowMoveModal(false);
    setMoveReason('');
  };

  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowPurpose.trim()) return;
    requestCheckout(doc.id, borrowPurpose.trim(), borrowDueDate);
    setShowBorrowModal(false);
    setBorrowPurpose('');
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckout) return;
    const targetRetLoc = returnLocationId || doc.homeLocationId;
    processCheckInReturn(activeCheckout.id, returnCondition, targetRetLoc, 'Checked in via Record Master Page');
    setShowReturnModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary btn-sm"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Catalogue
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="btn-secondary btn-sm"
          >
            <QrCode className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            Print QR Tag
          </button>
        </div>
      </div>

      {/* Main Document Master Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-6">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-mono font-extrabold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 rounded-lg">
                #{doc.documentNumber}
              </span>
              {doc.referenceNumber && <span className="text-xs font-mono text-zinc-500">REF: {doc.referenceNumber}</span>}
              <StatusBadge type="status" value={doc.status} size="md" />
              <StatusBadge type="confidentiality" value={doc.confidentiality} size="md" />
              {doc.status === 'DRAFT' && <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Details pending</span>}
            </div>

            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {doc.title || 'Untitled draft'}
            </h1>

            {doc.subject && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                {doc.subject}
              </p>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {doc.status === 'AVAILABLE' && (
              <button
                type="button"
                onClick={() => setShowBorrowModal(true)}
                className="btn-primary btn-sm"
                title="Request borrowing / check-out of this document"
              >
                <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
                Check Out
              </button>
            )}

            {isCheckedOut && (
              <button
                type="button"
                onClick={() => {
                  setReturnLocationId(doc.homeLocationId);
                  setShowReturnModal(true);
                }}
                className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                title="Check in and return this document to storage"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Check In & Return
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="btn-secondary btn-sm"
              title="Edit Document Metadata & Classification"
            >
              <Edit className="w-4 h-4" aria-hidden="true" />
              Edit
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetLocationId(doc.currentLocationId);
                setShowMoveModal(true);
              }}
              className="btn-secondary btn-sm"
              title="Relocate the physical document to another storage node"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              Relocate
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-danger-outline btn-sm"
              title="Delete Document Record"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>

        {doc.photos?.length > 0 && (
          <section className="grid gap-4 border-b border-zinc-100 pb-6 dark:border-zinc-800 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.6fr)]">
            <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <img src={doc.photos[selectedPhotoIndex]?.url || doc.photos[0].url} alt={doc.photos[selectedPhotoIndex]?.fileName || 'Document cover'} className="max-h-[520px] w-full object-contain" />
            </div>
            <div className="grid grid-cols-3 content-start gap-2 lg:grid-cols-2">
              {doc.photos.map((photo, index) => (
                <button key={photo.id} type="button" onClick={() => setSelectedPhotoIndex(index)} aria-label={`View document photo ${index + 1}${index === 0 ? ', cover image' : ''}`} aria-pressed={selectedPhotoIndex === index} className={`relative aspect-square overflow-hidden rounded-xl border-2 ${selectedPhotoIndex === index ? 'border-teal-500' : 'border-transparent'}`}>
                  <img src={photo.url} alt={photo.fileName || `Document photo ${index + 1}`} className="h-full w-full object-cover" />
                  {index === 0 && <span className="absolute left-1 top-1 rounded bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold text-white">COVER</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* CRITICAL PRD MANDATE RULE #77: Distinct Home Location vs Current Location Highlight Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Home Archive Location Box */}
          <div className="p-4 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Home Archive Storage Location (Permanent)
              </span>
              <span className="text-[10px] font-mono text-teal-600 font-bold">HOME</span>
            </div>
            
            <LocationPathBreadcrumbs
              locationId={doc.homeLocationId}
              onNodeClick={(id) => onNavigateLocation(id)}
            />

            <p className="text-[11px] text-teal-700 dark:text-teal-300 pt-1">
              Where this physical document permanently belongs in the archive vault.
            </p>
          </div>

          {/* Current Physical Location Box */}
          <div className={`p-4 rounded-2xl border space-y-2 ${
            isCheckedOut
              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800'
              : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isCheckedOut ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-900 dark:text-emerald-200'
              }`}>
                <MapPin className={`w-4 h-4 ${isCheckedOut ? 'text-amber-600' : 'text-emerald-600'}`} />
                Current Physical Location (Real-Time)
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                isCheckedOut ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {isCheckedOut ? 'CHECKED OUT' : 'AT HOME'}
              </span>
            </div>

            {isCheckedOut ? (
              <div className="space-y-1 text-xs">
                <p className="font-bold text-amber-950 dark:text-amber-100">
                  Custody: {doc.custodianName}
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Desk position: {currentPath}
                </p>
                {activeCheckout && (
                  <p className="text-[11px] font-mono text-amber-900 font-semibold pt-1">
                    Expected Return Date: {activeCheckout.dueDate}
                  </p>
                )}
              </div>
            ) : (
              <LocationPathBreadcrumbs
                locationId={doc.currentLocationId}
                onNodeClick={(id) => onNavigateLocation(id)}
              />
            )}
          </div>

        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div>
            <span className="text-zinc-400 font-medium block">Owning Department:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{doc.departmentName}</span>
          </div>

          <div>
            <span className="text-zinc-400 font-medium block">Document Type:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{doc.documentTypeName}</span>
          </div>

          <div>
            <span className="text-zinc-400 font-medium block">Retention Period Expiry:</span>
            <span className="font-semibold text-teal-600 font-mono">{doc.retentionEndDate}</span>
          </div>

          <div>
            <span className="text-zinc-400 font-medium block">Physical Condition:</span>
            <StatusBadge type="condition" value={doc.condition} size="sm" />
          </div>
        </div>

        {/* QR Code Claim Status Card */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
                QR Code Claim
              </span>
            </div>
            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${doc.qrClaimed
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
              {doc.qrClaimed ? 'CLAIMED' : 'UNCLAIMED'}
            </span>
          </div>

          <p className={`text-xs leading-relaxed ${doc.qrClaimed
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-amber-700 dark:text-amber-400'
            }`}>
            {doc.qrClaimed
              ? `Scanned on ${new Date(doc.qrClaimedAt || '').toLocaleString()} by ${doc.qrClaimedBy || 'system'}`
              : 'Not yet scanned - QR code may not have been printed yet.'
            }
          </p>

          {doc.qrClaimed && doc.qrClaimedAt && (
            <div className="flex gap-2 text-[10px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <ScanLine className="w-3 h-3" />
                {new Date(doc.qrClaimedAt).toLocaleString()}
              </span>
              {doc.qrClaimedBy && (
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {doc.qrClaimedBy}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Consolidated Dossier / Bundle Membership */}
        {(doc.bundleNumber || bundles.some(b => b.documentIds.includes(doc.id) || b.id === doc.bundleId)) && (() => {
          const parentBundle = bundles.find(b => b.documentIds.includes(doc.id) || b.id === doc.bundleId || b.bundleNumber === doc.bundleNumber);
          return (
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Dossier Bundle Association
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  {doc.bundleNumber || parentBundle?.bundleNumber}
                </span>
              </div>
              <div className="text-xs">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">
                  {doc.bundleTitle || parentBundle?.title || 'Consolidated Archive Dossier'}
                </p>
                {parentBundle?.description && (
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {parentBundle.description}
                  </p>
                )}
                {parentBundle && parentBundle.documentIds.length > 1 && (
                  <p className="text-[10px] font-mono text-amber-800 dark:text-amber-300 mt-1">
                    Bundled with {parentBundle.documentIds.length - 1} other related record(s)
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Dynamic Document Type Custom Fields Card */}
        {doc.customFieldValues && Object.keys(doc.customFieldValues).length > 0 && (
          <div className="p-4 bg-teal-50/60 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Custom Document Classification Attributes
              </span>
              <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                {doc.documentTypeName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs pt-1">
              {Object.entries(doc.customFieldValues).map(([key, val]) => (
                <div key={key} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-teal-100 dark:border-teal-900/60 shadow-xs space-y-0.5">
                  <span className="text-[10px] font-bold font-mono uppercase text-teal-600 dark:text-teal-400 block tracking-wider">{key}</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Digital Copy Attachment Preview Bar */}
        {doc.hasDigitalCopy && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <div>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                  Attached Digital Scan: {doc.digitalFileName}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {doc.digitalFileType} • {doc.digitalFileSize} • Version {doc.digitalFileVersion}
                </span>
              </div>
            </div>

            <a
              href={`/api/documents/${doc.id}/digital-copy`}
              download={doc.digitalFileName || 'digital-copy'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 hover:bg-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg font-medium shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Scan
            </a>
          </div>
        )}

      </div>

      {/* Tabbed History Panels: Movement History, Checkout Circulation, Audit Trail */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
        
        {/* Tab Headers */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'movements'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <History className="w-4 h-4" />
            Physical Movement History ({docMovements.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checkouts')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'checkouts'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Circulation Checkout Ledger ({docCheckouts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Audit Trail ({docAuditLogs.length})
          </button>
        </div>

        {/* Movements Tab Content */}
        {activeTab === 'movements' && (
          <div className="space-y-3">
            {docMovements.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-4">No movement history logged yet.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {docMovements.map(mvt => (
                  <div key={mvt.id} className="relative text-xs space-y-1">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-teal-600 ring-4 ring-teal-50 dark:ring-teal-950" />
                    
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {mvt.movementType} — {mvt.reason}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {new Date(mvt.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/80 dark:border-zinc-700 text-[11px] space-y-1">
                      <p><strong className="text-zinc-700 dark:text-zinc-300">From:</strong> {mvt.fromLocationPath}</p>
                      <p><strong className="text-teal-600 dark:text-teal-400">To:</strong> {mvt.toLocationPath}</p>
                      <p className="text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        Performed by: <strong>{mvt.performedByUserName}</strong>
                        {mvt.authorizedByUserName && ` • Approved by: ${mvt.authorizedByUserName}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Checkouts Tab Content */}
        {activeTab === 'checkouts' && (
          <div className="space-y-3 text-xs">
            {docCheckouts.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-4">No borrowing transactions recorded.</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {docCheckouts.map(chk => (
                  <div key={chk.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        Borrower: {chk.requestedByUserName} ({chk.requestedByDepartment})
                      </span>
                      <StatusBadge type="checkout" value={chk.status} size="sm" />
                    </div>
                    <p className="text-zinc-500">Purpose: {chk.purpose}</p>
                    <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-1 font-mono">
                      <span>Request: {chk.requestDate}</span>
                      <span>Due: {chk.dueDate}</span>
                      {chk.returnDate && <span className="text-emerald-600 font-bold">Returned: {chk.returnDate}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Logs Tab Content */}
        {activeTab === 'audit' && (
          <div className="space-y-3 text-xs">
            {docAuditLogs.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-4">No audit logs for this item.</p>
            ) : (
              <div className="space-y-2">
                {docAuditLogs.map(aud => (
                  <div key={aud.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{aud.action}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{new Date(aud.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200">{aud.details}</p>
                    <p className="text-[10px] text-zinc-400">User: {aud.userName} ({aud.userRole})</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* QR Tag Printable Modal */}
      {showQRModal && (
        <QRBarcodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          title={doc.title}
          subtitle={`Doc #: ${doc.documentNumber} | Ref: ${doc.referenceNumber}`}
          qrValue={doc.qrCode}
          barcodeValue={doc.barcode}
          entityType="DOCUMENT"
          entityCode={doc.documentNumber}
          pathString={homePath}
        />
      )}

      {/* Relocate Storage Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto text-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex-shrink-0">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                Relocate Physical Document Position
              </h3>
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMoveSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
                      Select Destination Storage Node *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowDestScanner(v => !v); setDestScanError(''); }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                        showDestScanner
                          ? 'text-white bg-teal-600 border-teal-600 hover:bg-teal-700'
                          : 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/60'
                      }`}
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      {showDestScanner ? 'Close Scanner' : 'Scan Location QR'}
                    </button>
                  </div>

                  {showDestScanner && (
                    <div className="mb-2 p-2 bg-zinc-900 rounded-xl border border-zinc-700">
                      <QrScannerView
                        onDecode={processDestScannedCode}
                        onError={(message) => setDestScanError(`Camera unavailable: ${message}`)}
                        className="w-full h-auto rounded-lg bg-zinc-950"
                      />
                      <p className="text-[10px] text-zinc-300 mt-1.5 text-center">
                        Scan the QR tag of the destination storage location
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1 text-center">
                        {SCANNER_TAG_HINT}
                      </p>
                      {destScanError && (
                        <p className="text-[10px] text-rose-400 font-semibold mt-1 text-center flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {destScanError}
                        </p>
                      )}
                    </div>
                  )}

                  <select
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none font-medium"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const destLoc = locations.find(l => l.id === targetLocationId);
                    return destLoc?.latitude != null && destLoc.longitude != null ? (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        GPS: {destLoc.latitude.toFixed(5)}, {destLoc.longitude.toFixed(5)}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Reason for Transfer
                  </label>
                  <input
                    type="text"
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    placeholder="e.g. Re-archiving, shelf consolidation, vault transfer"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-xl font-semibold shadow-md shadow-teal-600/20"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Borrowing Request Modal */}
      {showBorrowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto text-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex-shrink-0">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                Request Document Borrowing / Check-Out
              </h3>
              <button
                type="button"
                onClick={() => setShowBorrowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBorrowSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Purpose / Official Usage Reason *
                  </label>
                  <textarea
                    required
                    value={borrowPurpose}
                    onChange={(e) => setBorrowPurpose(e.target.value)}
                    rows={3}
                    placeholder="State official reason (e.g. Audit, Court Presentation, Site Survey)..."
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Target Return Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={borrowDueDate}
                    onChange={(e) => setBorrowDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBorrowModal(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-xl font-semibold shadow-md shadow-teal-600/20"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Processing Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto text-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex-shrink-0">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                Check In & Process Document Return
              </h3>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Inspected Return Physical Condition *
                  </label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value as DocumentCondition)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none font-semibold"
                  >
                    <option value="EXCELLENT">Excellent (Undamaged)</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair (Minor wear)</option>
                    <option value="DAMAGED">Damaged (Needs repair)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Target Home Storage Return Node *
                  </label>
                  <select
                    value={returnLocationId}
                    onChange={(e) => setReturnLocationId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none font-medium"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold shadow-md shadow-emerald-600/20"
                >
                  Confirm Check In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setIsDeleting(true);
          try {
            const success = await deleteDocument(doc.id);
            setIsDeleting(false);
            if (success) {
              addNotification('warning', `Record #${doc.documentNumber} deleted.`);
              setShowDeleteConfirm(false);
              onBack();
            } else {
              addNotification('error', `Could not delete record #${doc.documentNumber} — it may be checked out or in use.`);
            }
          } catch (err: any) {
            setIsDeleting(false);
            addNotification('error', err?.message || 'Delete failed.');
          }
        }}
        title="Delete Registered Document Record"
        message={`Are you sure you want to permanently delete registered document #${doc.documentNumber} (${doc.title})? This will permanently remove the record from physical repository catalogues.`}
        confirmText="Delete Permanently"
        variant="danger"
      />

      {/* Edit Document Record Modal */}
      <EditDocumentModal
        document={doc}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

    </div>
  );
};
