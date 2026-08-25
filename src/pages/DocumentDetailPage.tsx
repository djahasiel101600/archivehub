import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
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
    lookupByQR
  } = useArchive();

  const [activeTab, setActiveTab] = useState<'movements' | 'checkouts' | 'audit'>('movements');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Relocation Modal State
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetLocationId, setTargetLocationId] = useState(locations[0]?.id || '');
  const [moveReason, setMoveReason] = useState('');

  // Destination QR scan state (relocation modal)
  const [showDestScanner, setShowDestScanner] = useState(false);
  const [destScanError, setDestScanError] = useState('');
  const destScannerRef = useRef<Html5QrcodeScanner | null>(null);

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
    setTargetLocationId(loc.id);
    setDestScanError('');
    setShowDestScanner(false);
  }, [lookupByQR]);

  useEffect(() => {
    if (!(showMoveModal && showDestScanner)) return;

    let isCancelled = false;

    const timer = setTimeout(() => {
      if (isCancelled) return;
      const el = document.getElementById('doc-move-dest-qr-reader');
      if (!el) return;

      const localScanner = new Html5QrcodeScanner(
        'doc-move-dest-qr-reader',
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
  }, [showMoveModal, showDestScanner, processDestScannedCode]);

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
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Document Record Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">The requested document ID does not exist or has been removed.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl"
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalogue
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Print Document QR Tag
          </button>
        </div>
      </div>

      {/* Main Document Master Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-mono font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg">
                #{doc.documentNumber}
              </span>
              <span className="text-xs font-mono text-slate-500">REF: {doc.referenceNumber}</span>
              <StatusBadge type="status" value={doc.status} size="md" />
              <StatusBadge type="confidentiality" value={doc.confidentiality} size="md" />
            </div>

            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {doc.title}
            </h1>

            {doc.subject && (
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Request Borrowing / Check-Out
              </button>
            )}

            {isCheckedOut && (
              <button
                type="button"
                onClick={() => {
                  setReturnLocationId(doc.homeLocationId);
                  setShowReturnModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Check In & Return to Storage
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all shadow-sm"
              title="Edit Document Metadata & Classification"
            >
              <Edit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Edit Document
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetLocationId(doc.currentLocationId);
                setShowMoveModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
            >
              <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Relocate Physical Position
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all"
              title="Delete Document Record"
            >
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Delete Record
            </button>
          </div>
        </div>

        {/* CRITICAL PRD MANDATE RULE #77: Distinct Home Location vs Current Location Highlight Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Home Archive Location Box */}
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Home Archive Storage Location (Permanent)
              </span>
              <span className="text-[10px] font-mono text-indigo-600 font-bold">HOME</span>
            </div>
            
            <LocationPathBreadcrumbs
              locationId={doc.homeLocationId}
              onNodeClick={(id) => onNavigateLocation(id)}
            />

            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 pt-1">
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
                  📍 Desk Position: {currentPath}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Owning Department:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.departmentName}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Document Type:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.documentTypeName}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Retention Period Expiry:</span>
            <span className="font-semibold text-indigo-600 font-mono">{doc.retentionEndDate}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Physical Condition:</span>
            <StatusBadge type="condition" value={doc.condition} size="sm" />
          </div>
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
                <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  {doc.bundleNumber || parentBundle?.bundleNumber}
                </span>
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {doc.bundleTitle || parentBundle?.title || 'Consolidated Archive Dossier'}
                </p>
                {parentBundle?.description && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
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
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Custom Document Classification Attributes
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                {doc.documentTypeName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs pt-1">
              {Object.entries(doc.customFieldValues).map(([key, val]) => (
                <div key={key} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 shadow-xs space-y-0.5">
                  <span className="text-[10px] font-bold font-mono uppercase text-indigo-600 dark:text-indigo-400 block tracking-wider">{key}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Digital Copy Attachment Preview Bar */}
        {doc.hasDigitalCopy && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Attached Digital Scan: {doc.digitalFileName}
                </span>
                <span className="text-[10px] text-slate-400">
                  {doc.digitalFileType} • {doc.digitalFileSize} • Version {doc.digitalFileVersion}
                </span>
              </div>
            </div>

            <a
              href={`/api/documents/${doc.id}/digital-copy`}
              download={doc.digitalFileName || 'digital-copy'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg font-medium shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Scan
            </a>
          </div>
        )}

      </div>

      {/* Tabbed History Panels: Movement History, Checkout Circulation, Audit Trail */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        
        {/* Tab Headers */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'movements'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
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
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
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
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
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
              <p className="text-xs text-slate-400 italic py-4">No movement history logged yet.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {docMovements.map(mvt => (
                  <div key={mvt.id} className="relative text-xs space-y-1">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-950" />
                    
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {mvt.movementType} — {mvt.reason}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(mvt.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700 text-[11px] space-y-1">
                      <p><strong className="text-slate-700 dark:text-slate-300">From:</strong> {mvt.fromLocationPath}</p>
                      <p><strong className="text-indigo-600 dark:text-indigo-400">To:</strong> {mvt.toLocationPath}</p>
                      <p className="text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
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
              <p className="text-xs text-slate-400 italic py-4">No borrowing transactions recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {docCheckouts.map(chk => (
                  <div key={chk.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        Borrower: {chk.requestedByUserName} ({chk.requestedByDepartment})
                      </span>
                      <StatusBadge type="checkout" value={chk.status} size="sm" />
                    </div>
                    <p className="text-slate-500">Purpose: {chk.purpose}</p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 font-mono">
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
              <p className="text-xs text-slate-400 italic py-4">No audit logs for this item.</p>
            ) : (
              <div className="space-y-2">
                {docAuditLogs.map(aud => (
                  <div key={aud.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{aud.action}</span>
                      <span className="font-mono text-[10px] text-slate-400">{new Date(aud.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200">{aud.details}</p>
                    <p className="text-[10px] text-slate-400">User: {aud.userName} ({aud.userRole})</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto text-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Relocate Physical Document Position
              </h3>
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMoveSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      Select Destination Storage Node *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowDestScanner(v => !v); setDestScanError(''); }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                        showDestScanner
                          ? 'text-white bg-indigo-600 border-indigo-600 hover:bg-indigo-700'
                          : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                      }`}
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      {showDestScanner ? 'Close Scanner' : 'Scan Location QR'}
                    </button>
                  </div>

                  {showDestScanner && (
                    <div className="mb-2 p-2 bg-slate-900 rounded-xl border border-slate-700">
                      <div id="doc-move-dest-qr-reader" className="rounded-lg overflow-hidden" />
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
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
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
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        GPS: {destLoc.latitude.toFixed(5)}, {destLoc.longitude.toFixed(5)}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Transfer
                  </label>
                  <input
                    type="text"
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    placeholder="e.g. Re-archiving, shelf consolidation, vault transfer"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto text-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Request Document Borrowing / Check-Out
              </h3>
              <button
                type="button"
                onClick={() => setShowBorrowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBorrowSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purpose / Official Usage Reason *
                  </label>
                  <textarea
                    required
                    value={borrowPurpose}
                    onChange={(e) => setBorrowPurpose(e.target.value)}
                    rows={3}
                    placeholder="State official reason (e.g. Audit, Court Presentation, Site Survey)..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Return Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={borrowDueDate}
                    onChange={(e) => setBorrowDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBorrowModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto text-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Check In & Process Document Return
              </h3>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inspected Return Physical Condition *
                  </label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value as DocumentCondition)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-semibold"
                  >
                    <option value="EXCELLENT">Excellent (Undamaged)</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair (Minor wear)</option>
                    <option value="DAMAGED">Damaged (Needs repair)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Home Storage Return Node *
                  </label>
                  <select
                    value={returnLocationId}
                    onChange={(e) => setReturnLocationId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-medium"
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
        onConfirm={() => {
          const success = deleteDocument(doc.id);
          if (success) {
            onBack();
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
