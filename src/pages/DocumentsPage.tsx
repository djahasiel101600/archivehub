import React, { useState, useEffect, useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { 
  FileText, 
  Search, 
  Plus, 
  Filter, 
  LayoutGrid, 
  List, 
  Eye, 
  QrCode, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  FilePlus, 
  ArrowRightLeft, 
  X,
  HardDrive,
  SlidersHorizontal,
  Layers,
  Tag,
  Trash2,
  Printer,
  FolderPlus,
  CheckSquare,
  Square,
  BookmarkCheck,
  Check,
  Edit,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Clock,
  Camera
} from 'lucide-react';
import { DocumentStatus, ConfidentialityLevel, DocumentCondition, DocumentItem } from '../types';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PageHeader } from '../components/common/PageHeader';
import { DocumentTypeCombobox } from '../components/common/DocumentTypeCombobox';
import { BulkTagPrintModal } from '../components/documents/BulkTagPrintModal';
import { BulkUpdateModal } from '../components/documents/BulkUpdateModal';
import { BundleModal } from '../components/documents/BundleModal';
import { EditDocumentModal } from '../components/documents/EditDocumentModal';
import { DocumentCapturePage } from './DocumentCapturePage';

interface DocumentsPageProps {
  onSelectDocument: (docId: string) => void;
  openRegisterModalDirectly?: boolean;
  onClearTrigger?: () => void;
}

// E7/T-04: remember the operator's last-used intake context (same pattern as
// the photo-capture presets) instead of silently defaulting to array index 0.
const QUICK_REG_PRESET_STORAGE_KEY = 'archivehub_quick_register_presets';

interface QuickRegisterPresets {
  departmentId: string;
  documentTypeId: string;
  homeLocationId: string;
}

function getQuickRegisterPresets(): QuickRegisterPresets {
  try {
    const saved = localStorage.getItem(QUICK_REG_PRESET_STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        const values = parsed as Record<string, unknown>;
        return {
          departmentId: typeof values.departmentId === 'string' ? values.departmentId : '',
          documentTypeId: typeof values.documentTypeId === 'string' ? values.documentTypeId : '',
          homeLocationId: typeof values.homeLocationId === 'string' ? values.homeLocationId : '',
        };
      }
    }
  } catch {
    // Presets are a convenience only — fall back to explicit selection.
  }
  return { departmentId: '', documentTypeId: '', homeLocationId: '' };
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({
  onSelectDocument,
  openRegisterModalDirectly,
  onClearTrigger
}) => {
  const { 
    documents, 
    departments, 
    documentTypes, 
    locations, 
    bundles,
    addDocument, 
    deleteDocument,
    bulkDeleteDocuments,
    globalSearchQuery, 
    setGlobalSearchQuery,
    calculatePath,
    getNextDocumentNumber
  } = useArchive();

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [frozenCol, setFrozenCol] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedConf, setSelectedConf] = useState<string>('ALL');
  const [selectedBundleFilter, setSelectedBundleFilter] = useState<string>('ALL');
  const [selectedQrClaim, setSelectedQrClaim] = useState<'ALL' | 'CLAIMED' | 'UNCLAIMED'>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);

  // Bulk Selection & Modals State
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);
  const [bulkUpdateMode, setBulkUpdateMode] = useState<'security' | 'department' | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);

  // Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(Boolean(openRegisterModalDirectly));
  const [showCaptureWorkspace, setShowCaptureWorkspace] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string; number: string; title: string } | null>(null);
  const [docToEdit, setDocToEdit] = useState<DocumentItem | null>(null);

  useEffect(() => {
    if (openRegisterModalDirectly) {
      setShowRegisterModal(true);
      if (onClearTrigger) {
        onClearTrigger();
      }
    }
  }, [openRegisterModalDirectly, onClearTrigger]);
  
  // Registration Form state
  const [regDocNumber, setRegDocNumber] = useState('');
  const [regRefNumber, setRegRefNumber] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [rememberedPresets] = useState(getQuickRegisterPresets);
  const [regDeptId, setRegDeptId] = useState(rememberedPresets.departmentId);
  
  // Filter available document types based on selected Owning Department
  const availableDocTypesForDept = documentTypes.filter(
    dt => !dt.departmentId || dt.departmentId === 'ALL' || dt.departmentId === regDeptId
  );

  const [regTypeId, setRegTypeId] = useState(rememberedPresets.documentTypeId);
  const [regHomeLocationId, setRegHomeLocationId] = useState(rememberedPresets.homeLocationId);

  // Continuous intake (E7/T-01): "Save & register next" keeps the modal open,
  // clears only per-record fields and refocuses the title for the next record.
  const [sessionCount, setSessionCount] = useState(0);
  const [lastSavedNumber, setLastSavedNumber] = useState('');
  const submitModeRef = useRef<'next' | 'close'>('next');
  const regTitleRef = useRef<HTMLInputElement>(null);
  const regFormBodyRef = useRef<HTMLDivElement>(null);

  // Live preview of the auto-generated number ({DEPT_CODE}-{TYPE_CODE}-{NNNN})
  // shown while the Document Number field is left blank
  const [autoNumberPreview, setAutoNumberPreview] = useState('');
  useEffect(() => {
    if (!showRegisterModal || regDocNumber.trim()) {
      setAutoNumberPreview('');
      return;
    }
    let cancelled = false;
    getNextDocumentNumber(regDeptId, regTypeId).then(num => {
      if (!cancelled) setAutoNumberPreview(num || '');
    });
    return () => { cancelled = true; };
  }, [showRegisterModal, regDeptId, regTypeId, regDocNumber, getNextDocumentNumber, sessionCount]);
  const [regSubject, setRegSubject] = useState('');
  const [regDescription, setRegDescription] = useState('');
  const [regConfidentiality, setRegConfidentiality] = useState<ConfidentialityLevel>('CONFIDENTIAL');
  const [regCondition, setRegCondition] = useState<DocumentCondition>('EXCELLENT');
  const [regDocDate, setRegDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [regHasDigitalCopy, setRegHasDigitalCopy] = useState(false);
  const [regDigitalFileName, setRegDigitalFileName] = useState('');
  const [regCustomValues, setRegCustomValues] = useState<Record<string, string | number>>({});

  // When regDeptId changes, keep the selected type only if it is still valid
  // for the new department — otherwise clear it for an explicit choice (T-04).
  const handleDeptChange = (newDeptId: string) => {
    setRegDeptId(newDeptId);
    const typeStillValid = documentTypes.some(
      dt => dt.id === regTypeId && (!dt.departmentId || dt.departmentId === 'ALL' || dt.departmentId === newDeptId)
    );
    if (!typeStillValid) {
      setRegTypeId('');
      setRegCustomValues({});
    }
  };

  // Drop a selected/remembered type only when it becomes invalid — never
  // silently auto-fill an empty selection.
  useEffect(() => {
    if (!regTypeId) return;
    const stillValid = documentTypes.some(
      dt => dt.id === regTypeId && (!dt.departmentId || dt.departmentId === 'ALL' || dt.departmentId === regDeptId)
    );
    if (!stillValid) {
      setRegTypeId('');
      setRegCustomValues({});
    }
  }, [documentTypes, regDeptId, regTypeId]);

  // Clear remembered values that no longer exist once entities load.
  useEffect(() => {
    if (departments.length) setRegDeptId(cur => (cur && !departments.some(d => d.id === cur)) ? '' : cur);
    if (documentTypes.length) setRegTypeId(cur => (cur && !documentTypes.some(dt => dt.id === cur)) ? '' : cur);
    if (locations.length) setRegHomeLocationId(cur => (cur && !locations.some(l => l.id === cur)) ? '' : cur);
  }, [departments, documentTypes, locations]);

  // Persist the last-used intake context once all three choices are valid.
  useEffect(() => {
    if (
      !departments.some(d => d.id === regDeptId) ||
      !documentTypes.some(dt => dt.id === regTypeId) ||
      !locations.some(l => l.id === regHomeLocationId)
    ) return;
    try {
      localStorage.setItem(QUICK_REG_PRESET_STORAGE_KEY, JSON.stringify({
        departmentId: regDeptId,
        documentTypeId: regTypeId,
        homeLocationId: regHomeLocationId,
      }));
    } catch {
      // Presets are a convenience only — ignore storage failures.
    }
  }, [regDeptId, regTypeId, regHomeLocationId, departments, documentTypes, locations]);

  // Reset custom field values when document type changes
  const handleTypeChange = (newTypeId: string) => {
    setRegTypeId(newTypeId);
    const docType = documentTypes.find(dt => dt.id === newTypeId);
    const initialValues: Record<string, string | number> = {};
    if (docType?.customFields) {
      docType.customFields.forEach(f => {
        initialValues[f.name] = f.type === 'select' && f.options?.[0] ? f.options[0] : '';
      });
    }
    setRegCustomValues(initialValues);
  };

  // Sequential reference numbers instead of random suffixes (M-17 mitigation):
  // max existing REF-#### suffix + 1, zero-padded.
  const nextReferenceNumber = (): string => {
    let max = 0;
    for (const d of documents) {
      const match = d.referenceNumber?.match(/^REF-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    }
    return `REF-${String(max + 1).padStart(4, '0')}`;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering || !regTitle.trim() || !regDeptId || !regHomeLocationId || !regTypeId) return;
    const mode = submitModeRef.current;
    setIsRegistering(true);

    const selectedDocType = documentTypes.find(dt => dt.id === regTypeId);
    const selectedDeptObj = departments.find(d => d.id === regDeptId);

    // Blank field = structured auto-generation on the server from the
    // department code + document type classification code
    const docNum = regDocNumber.trim();
    const retentionYears = selectedDocType?.retentionYears || 10;
    
    const startDate = new Date().toISOString().split('T')[0];
    const endDateObj = new Date();
    endDateObj.setFullYear(endDateObj.getFullYear() + retentionYears);
    const endDate = endDateObj.toISOString().split('T')[0];

    try {
      const newDoc = await addDocument({
        documentNumber: docNum,
        referenceNumber: regRefNumber.trim() || nextReferenceNumber(),
        title: regTitle.trim(),
        documentTypeId: regTypeId,
        documentTypeName: selectedDocType?.name || 'General Record',
        subject: regSubject.trim(),
        description: regDescription.trim(),
        departmentId: regDeptId,
        departmentName: selectedDeptObj?.name || 'General Department',
        custodianName: 'Records Office',
        homeLocationId: regHomeLocationId,
        confidentiality: regConfidentiality,
        condition: regCondition,
        documentDate: regDocDate,
        receivedDate: startDate,
        filedDate: startDate,
        retentionStartDate: startDate,
        retentionEndDate: endDate,
        hasDigitalCopy: regHasDigitalCopy,
        digitalFileName: regHasDigitalCopy ? (regDigitalFileName.trim() || `${docNum.replace(/[^a-zA-Z0-9]/g, '_')}_digitized.pdf`) : undefined,
        digitalFileSize: regHasDigitalCopy ? '2.4 MB' : undefined,
        digitalFileType: regHasDigitalCopy ? 'PDF' : undefined,
        digitalFileVersion: regHasDigitalCopy ? 1 : undefined,
        photos: [],
        customFieldValues: regCustomValues
      });

      // Clear per-record fields only; dept/type/location/classification stay
      // as the operator's intake context for the next record.
      setRegDocNumber('');
      setRegRefNumber('');
      setRegTitle('');
      setRegSubject('');
      setRegDescription('');
      setRegHasDigitalCopy(false);
      setRegDigitalFileName('');
      handleTypeChange(regTypeId);
      if (mode === 'close') {
        setShowRegisterModal(false);
      } else {
        setLastSavedNumber(newDoc.documentNumber);
        setSessionCount(count => count + 1);
        regFormBodyRef.current?.scrollTo({ top: 0 });
        requestAnimationFrame(() => regTitleRef.current?.focus());
      }
    } catch {
      // Keep the form open so the user can correct the issue or retry the save.
    } finally {
      setIsRegistering(false);
      submitModeRef.current = 'next';
    }
  };

  // Selection Handlers
  const handleToggleSelectDoc = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDocIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedDocIds.length === filteredDocs.length && filteredDocs.length > 0) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocs.map(d => d.id));
    }
  };

  // Filter logic
  const filteredDocs = documents.filter(doc => {
    // Search query filter
    if (globalSearchQuery.trim()) {
      const q = globalSearchQuery.toLowerCase();
      const homePath = calculatePath(doc.homeLocationId).toLowerCase();
      const currentPath = calculatePath(doc.currentLocationId).toLowerCase();
      const customValuesStr = doc.customFieldValues ? Object.values(doc.customFieldValues).join(' ').toLowerCase() : '';

      const match = 
        doc.documentNumber.toLowerCase().includes(q) ||
        doc.title.toLowerCase().includes(q) ||
        (doc.referenceNumber || '').toLowerCase().includes(q) ||
        (doc.subject && doc.subject.toLowerCase().includes(q)) ||
        doc.departmentName.toLowerCase().includes(q) ||
        (doc.bundleNumber && doc.bundleNumber.toLowerCase().includes(q)) ||
        (doc.bundleTitle && doc.bundleTitle.toLowerCase().includes(q)) ||
        homePath.includes(q) ||
        currentPath.includes(q) ||
        customValuesStr.includes(q);

      if (!match) return false;
    }

    if (selectedDept !== 'ALL' && doc.departmentId !== selectedDept) return false;
    if (selectedType !== 'ALL' && doc.documentTypeId !== selectedType) return false;
    if (selectedStatus !== 'ALL' && doc.status !== selectedStatus) return false;
    if (selectedConf !== 'ALL' && doc.confidentiality !== selectedConf) return false;

    if (selectedQrClaim !== 'ALL') {
      const isClaimed = Boolean(doc.qrClaimed);
      if (selectedQrClaim === 'CLAIMED' && !isClaimed) return false;
      if (selectedQrClaim === 'UNCLAIMED' && isClaimed) return false;
    }

    if (selectedBundleFilter !== 'ALL') {
      if (selectedBundleFilter === 'BUNDLED') {
        const isBundled = Boolean(doc.bundleId || doc.bundleNumber || bundles.some(b => b.documentIds.includes(doc.id)));
        if (!isBundled) return false;
      } else if (selectedBundleFilter === 'UNBUNDLED') {
        const isBundled = Boolean(doc.bundleId || doc.bundleNumber || bundles.some(b => b.documentIds.includes(doc.id)));
        if (isBundled) return false;
      } else {
        // Specific bundle ID
        const targetBundle = bundles.find(b => b.id === selectedBundleFilter);
        const inThisBundle = targetBundle?.documentIds.includes(doc.id) || doc.bundleId === selectedBundleFilter || doc.bundleNumber === targetBundle?.bundleNumber;
        if (!inThisBundle) return false;
      }
    }

    // Date Range Filter (based on createdAt / date registered)
    if (filterDateFrom || filterDateTo) {
      const docDate = doc.createdAt ? doc.createdAt.split('T')[0] : '';
      if (filterDateFrom && docDate < filterDateFrom) return false;
      if (filterDateTo && docDate > filterDateTo) return false;
    }

    return true;
  });

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDocs = filteredDocs.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = filteredDocs.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filteredDocs.length);

  // Reset to the first page whenever any filter / search input changes
  useEffect(() => {
    setCurrentPage(1);
  }, [globalSearchQuery, selectedDept, selectedType, selectedStatus, selectedConf, selectedBundleFilter, selectedQrClaim, filterDateFrom, filterDateTo, viewMode]);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis-start');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    return pages;
  };

  const handleToggleSelectPage = () => {
    const pageIds = paginatedDocs.map(d => d.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedDocIds.includes(id));
    if (allSelected) {
      setSelectedDocIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedDocIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const selectedDocuments = documents.filter(d => selectedDocIds.includes(d.id));

  // Drafts worklist: captures saved before metadata was completed. They are
  // real registry records (with reserved numbers/barcodes) awaiting finish-up.
  const draftCount = documents.filter(d => d.status === 'DRAFT').length;

  // Filter activity summary drives the "More filters" badge and reset action.
  const advancedFilterCount = [
    selectedBundleFilter !== 'ALL',
    selectedConf !== 'ALL',
    selectedQrClaim !== 'ALL',
    Boolean(filterDateFrom || filterDateTo)
  ].filter(Boolean).length;
  const anyFilterActive = globalSearchQuery.trim() !== '' || selectedDept !== 'ALL' || selectedType !== 'ALL' || selectedStatus !== 'ALL' || advancedFilterCount > 0;
  const resetFilters = () => {
    setGlobalSearchQuery('');
    setSelectedDept('ALL');
    setSelectedType('ALL');
    setSelectedStatus('ALL');
    setSelectedConf('ALL');
    setSelectedBundleFilter('ALL');
    setSelectedQrClaim('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  if (showCaptureWorkspace) {
    return (
      <DocumentCapturePage
        onCancel={() => setShowCaptureWorkspace(false)}
        onSaved={document => {
          setShowCaptureWorkspace(false);
          onSelectDocument(document.id);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      <PageHeader
        icon={FileText}
        title="Documents"
        description="Search and manage archived records, locations, and digital copies."
        actions={
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Register document
          </button>
          <button
            type="button"
            onClick={() => setShowCaptureWorkspace(true)}
            className="btn-secondary"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Capture cover
          </button>
          </div>
        }
      />

      {/* Drafts worklist — incomplete captures waiting to be finalized */}
      {draftCount > 0 && selectedStatus !== 'DRAFT' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/40">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              {draftCount} draft record{draftCount === 1 ? '' : 's'} awaiting completion — captured covers with unfinished metadata.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedStatus('DRAFT')}
            className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700"
          >
            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
            Review drafts
          </button>
        </div>
      )}

      {selectedStatus === 'DRAFT' && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/40">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            Showing draft records only. Open a record to complete its metadata and finalize it into the registry.
          </p>
        </div>
      )}

      {/* Filter Control Toolbar — primary filters always visible, the rest
          collapse behind "More filters" to keep the archive scannable. */}
      <div className="card p-3 sm:p-4 space-y-3">

        <div className="flex flex-col lg:flex-row gap-2 text-xs">

          {/* Keyword Search */}
          <div className="relative flex-1 min-w-0 lg:min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -tranzinc-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search doc #, title, reference…"
              aria-label="Search documents"
              className="input pl-9"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            aria-label="Filter by department"
            className="input lg:w-44"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Document Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Filter by document type"
            className="input lg:w-44"
          >
            <option value="ALL">All Document Types</option>
            {documentTypes.map(dt => (
              <option key={dt.id} value={dt.id}>{dt.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filter by status"
            className="input lg:w-40"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft (incomplete)</option>
            <option value="AVAILABLE">Available</option>
            <option value="CHECKED_OUT">Checked Out</option>
            <option value="REQUESTED">Requested</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              aria-expanded={showAdvancedFilters || advancedFilterCount > 0}
              className={`btn-secondary btn-sm ${advancedFilterCount > 0 ? 'border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300' : ''}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              More filters
              {advancedFilterCount > 0 && (
                <span className="chip bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">{advancedFilterCount}</span>
              )}
            </button>
            {anyFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-ghost btn-sm"
                title="Clear all filters"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Advanced filters */}
        {(showAdvancedFilters || advancedFilterCount > 0) && (
          <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

              {/* Bundle / Dossier Filter */}
              <select
                value={selectedBundleFilter}
                onChange={(e) => setSelectedBundleFilter(e.target.value)}
                aria-label="Filter by bundle"
                className="input"
              >
                <option value="ALL">All Bundles & Single Items</option>
                <option value="BUNDLED">Only Bundled Records</option>
                <option value="UNBUNDLED">Only Unbundled Records</option>
                {bundles.map(b => (
                  <option key={b.id} value={b.id}>
                    Dossier: {b.bundleNumber} ({b.title.slice(0, 20)}...)
                  </option>
                ))}
              </select>

              {/* Confidentiality Filter */}
              <select
                value={selectedConf}
                onChange={(e) => setSelectedConf(e.target.value)}
                aria-label="Filter by confidentiality"
                className="input"
              >
                <option value="ALL">All Confidentiality</option>
                <option value="PUBLIC">Public</option>
                <option value="INTERNAL">Internal</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="RESTRICTED">Restricted</option>
              </select>

              {/* QR Claim Filter */}
              <select
                value={selectedQrClaim}
                onChange={(e) => setSelectedQrClaim(e.target.value as 'ALL' | 'CLAIMED' | 'UNCLAIMED')}
                aria-label="Filter by QR claim status"
                className="input"
              >
                <option value="ALL">All Documents (QR)</option>
                <option value="CLAIMED">QR Claimed (Scanned)</option>
                <option value="UNCLAIMED">QR Unclaimed (Not yet scanned)</option>
              </select>
            </div>

            {/* Date Registered Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                Date Registered:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {(() => {
                  const t = new Date().toISOString().split('T')[0];
                  const ago = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0]; };
                  const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                  return ([
                    { label: 'Today', from: t, to: t },
                    { label: 'Yesterday', from: ago(1), to: ago(1) },
                    { label: 'Last 7 Days', from: ago(7), to: t },
                    { label: 'Last 30 Days', from: ago(30), to: t },
                    { label: 'This Month', from: mStart, to: t },
                  ] as { label: string; from: string; to: string }[]).map(p => {
                    const active = filterDateFrom === p.from && filterDateTo === p.to;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => { setFilterDateFrom(p.from); setFilterDateTo(p.to); }}
                        aria-pressed={active}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                          active
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-teal-300 dark:hover:border-teal-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  });
                })()}
              </div>
              <div className="flex items-center gap-1.5 sm:ml-auto">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="input h-8 w-auto px-2 text-[11px]"
                  aria-label="Registered from date"
                  title="From date"
                />
                <span className="text-[10px] text-zinc-400 font-bold">→</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="input h-8 w-auto px-2 text-[11px]"
                  aria-label="Registered to date"
                  title="To date"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    type="button"
                    onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                    className="p-1 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    aria-label="Clear date filter"
                    title="Clear date filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Bar & View Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-zinc-900 dark:text-zinc-100">{rangeStart}–{rangeEnd}</strong> of <strong className="text-zinc-900 dark:text-zinc-100">{filteredDocs.length}</strong> filtered records ({documents.length} total)
            </span>
            {selectedDocIds.length > 0 && (
              <span className="text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded-lg border border-teal-200 dark:border-teal-800">
                {selectedDocIds.length} item(s) selected
              </span>
            )}
            {filteredDocs.length > 0 && selectedDocIds.length < filteredDocs.length && paginatedDocs.length > 0 && paginatedDocs.every(d => selectedDocIds.includes(d.id)) && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-teal-600 dark:text-teal-400 font-semibold hover:underline"
              >
                Select all {filteredDocs.length} filtered
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {viewMode === 'table' && (
              <button
                type="button"
                onClick={() => setFrozenCol(prev => !prev)}
                title={frozenCol ? 'Unlock Title & Subject column' : 'Lock Title & Subject column'}
                className={`p-1.5 rounded-lg border flex items-center gap-1 text-[10px] font-semibold transition-all ${
                  frozenCol
                    ? 'bg-teal-50 border-teal-200 text-teal-600 dark:bg-teal-950 dark:border-teal-800 dark:text-teal-400'
                    : 'border-zinc-200 text-zinc-400 hover:text-zinc-600 dark:border-zinc-700'
                }`}
              >
                {frozenCol ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{frozenCol ? 'Locked' : 'Unlocked'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg border ${
                viewMode === 'table'
                  ? 'bg-teal-50 border-teal-200 text-teal-600 dark:bg-teal-950 dark:border-teal-800 dark:text-teal-400'
                  : 'border-zinc-200 text-zinc-400 hover:text-zinc-600 dark:border-zinc-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg border ${
                viewMode === 'grid'
                  ? 'bg-teal-50 border-teal-200 text-teal-600 dark:bg-teal-950 dark:border-teal-800 dark:text-teal-400'
                  : 'border-zinc-200 text-zinc-400 hover:text-zinc-600 dark:border-zinc-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* BULK ACTIONS BAR — stays visible while scrolling the results so
          batch operations are always one click away. */}
      {selectedDocIds.length > 0 && (
        <div className="sticky top-16 z-20 card border-teal-200 dark:border-teal-800 bg-teal-50/95 dark:bg-teal-950/70 backdrop-blur-sm p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="chip bg-teal-600 text-white px-2 py-1 text-xs font-semibold">
              {selectedDocIds.length}
            </span>
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
              record{selectedDocIds.length === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setShowBulkPrintModal(true)}
              className="btn-primary btn-sm"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Print Tags
            </button>

            <button
              type="button"
              onClick={() => setShowBundleModal(true)}
              className="btn-secondary btn-sm"
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              Bundle
            </button>

            <button
              type="button"
              onClick={() => setBulkUpdateMode('security')}
              className="btn-secondary btn-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Security & Condition
            </button>

            <button
              type="button"
              onClick={() => setBulkUpdateMode('department')}
              className="btn-secondary btn-sm"
            >
              <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
              Department
            </button>

            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="btn-danger-outline btn-sm"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Delete
            </button>

            <button
              type="button"
              onClick={() => setSelectedDocIds([])}
              className="btn-ghost btn-sm"
            >
              Deselect all
            </button>
          </div>
        </div>
      )}

      {/* Main Table / Grid Results View */}
      <div ref={resultsTopRef} className="scroll-mt-24">
      {paginatedDocs.length === 0 ? (
        <div className="card empty-state">
          <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            {documents.length === 0 ? 'No records in the archive yet' : 'No records match your filters'}
          </p>
          <p className="text-xs">
            {documents.length === 0
              ? 'Register a document or capture a cover to get started.'
              : 'Try a different search term or clear the active filters.'}
          </p>
          {anyFilterActive && (
            <button type="button" onClick={resetFilters} className="btn-secondary btn-sm mt-1">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Reset filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wide">
                <tr>
                  {/* Select All Checkbox */}
                  <th className={`px-3 py-3.5 w-10 text-center border-r border-zinc-200/80 dark:border-zinc-800/80 ${frozenCol ? 'sticky left-0 z-30 bg-zinc-50 dark:bg-zinc-800/60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={paginatedDocs.length > 0 && paginatedDocs.every(d => selectedDocIds.includes(d.id))}
                      onChange={handleToggleSelectPage}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                      title="Select / Deselect Current Page"
                    />
                  </th>
                  {/* Column 1: Title & Subject */}
                  <th className={`border-r border-zinc-200/80 dark:border-zinc-800/80 min-w-[240px] max-w-[320px] px-4 py-3.5 ${frozenCol ? 'sticky left-[40px] z-20 bg-zinc-50 dark:bg-zinc-800/60 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]' : ''}`}>
                    Title & Subject
                  </th>
                  <th className="px-4 py-3.5 min-w-[170px] whitespace-nowrap border-r border-zinc-200/80 dark:border-zinc-800/80">Doc & Ref #</th>
                  <th className="px-4 py-3.5 min-w-[160px] whitespace-nowrap border-r border-zinc-200/80 dark:border-zinc-800/80">Department</th>
                  <th className="px-4 py-3.5 min-w-[190px] whitespace-nowrap border-r border-zinc-200/80 dark:border-zinc-800/80">Security & Condition</th>
                  <th className="px-4 py-3.5 min-w-[140px] whitespace-nowrap border-r border-zinc-200/80 dark:border-zinc-800/80">Circulation Status</th>
                  <th className="px-4 py-3.5 min-w-[260px] whitespace-nowrap border-r border-zinc-200/80 dark:border-zinc-800/80">Home Storage Location</th>
                  <th className="px-4 py-3.5 min-w-[260px] whitespace-nowrap border-r border-zinc-200/80 dark:border-zinc-800/80">Current Physical Position</th>
                  <th className="px-4 py-3.5 min-w-[100px] text-right whitespace-nowrap">Actions</th>
                <th className="px-4 py-3.5 min-w-[130px] whitespace-nowrap">QR Claim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 font-medium">
                {paginatedDocs.map(doc => {
                  const isCheckedOut = doc.status === 'CHECKED_OUT';
                  const isSelected = selectedDocIds.includes(doc.id);
                  const parentBundle = bundles.find(b => b.documentIds.includes(doc.id) || b.id === doc.bundleId || b.bundleNumber === doc.bundleNumber);

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => onSelectDocument(doc.id)}
                      className={`group cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-teal-50/70 dark:bg-teal-950/40' 
                          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td 
                        className={`px-3 py-3 w-10 text-center border-r border-zinc-200/60 dark:border-zinc-800/60 ${frozenCol ? `sticky left-0 z-30 ${isSelected ? 'bg-teal-50/90 dark:bg-teal-950/60' : 'bg-white dark:bg-zinc-900 group-hover:bg-zinc-50/90 dark:group-hover:bg-zinc-800/60'}` : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectDoc(doc.id, e as any)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </td>

                      {/* Column 1: Title & Subject */}
                      <td 
                        className={`border-r border-zinc-200/80 dark:border-zinc-800/80 min-w-[240px] max-w-[320px] px-4 py-3 ${frozenCol ? `sticky left-[40px] z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] ${isSelected ? 'bg-teal-50/90 dark:bg-teal-950/60' : 'bg-white dark:bg-zinc-900 group-hover:bg-zinc-50/90 dark:group-hover:bg-zinc-800/60'}` : ''}`}
                        title={doc.title || 'Untitled draft'}
                      >
                        <div className="flex items-start gap-2.5">
                          {doc.photos?.[0] && (
                            <img src={doc.photos[0].url} alt="" className="h-12 w-10 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-zinc-700" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                              {doc.title || 'Untitled draft'}
                            </div>
                            {doc.status === 'DRAFT' && <span className="mt-1 inline-block"><StatusBadge type="status" value="DRAFT" size="sm" /></span>}
                          </div>
                        </div>
                        
                        {/* Bundle Badge */}
                        {(doc.bundleNumber || parentBundle) && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span 
                              className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800"
                              title={`Part of Dossier: ${doc.bundleTitle || parentBundle?.title}`}
                            >
                              <Layers className="w-3 h-3 text-amber-600" />
                              <span>{doc.bundleNumber || parentBundle?.bundleNumber}</span>
                            </span>
                          </div>
                        )}

                        {/* Custom Field Disambiguation Badges */}
                        {doc.customFieldValues && Object.keys(doc.customFieldValues).length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {Object.entries(doc.customFieldValues).map(([key, val]) => (
                              <span 
                                key={key} 
                                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-teal-50/80 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded border border-teal-200/80 dark:border-teal-800/60"
                                title={`${key}: ${val}`}
                              >
                                <span className="text-zinc-400 font-normal">{key}:</span> {val}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
                          <span className="line-clamp-1 font-normal" title={doc.subject || doc.documentTypeName}>
                            {doc.subject || doc.documentTypeName}
                          </span>
                          {doc.hasDigitalCopy && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50 flex-shrink-0" title={`Digital Scan: ${doc.digitalFileName}`}>
                              <HardDrive className="w-3 h-3 text-emerald-600" />
                              PDF
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 2: Doc Number & Ref */}
                      <td className="px-4 py-3 min-w-[170px] whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="font-mono font-bold text-teal-600 dark:text-teal-400 text-xs">
                          #{doc.documentNumber}
                        </div>
                        {doc.referenceNumber && (
                          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                            Ref: {doc.referenceNumber}
                          </div>
                        )}
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                          {doc.documentTypeName}
                        </div>
                      </td>

                      {/* Column 3: Department */}
                      <td className="px-4 py-3 min-w-[160px] whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs">
                          {doc.departmentName}
                        </span>
                      </td>

                      {/* Column 4: Security & Condition */}
                      <td className="px-4 py-3 min-w-[190px] whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge type="confidentiality" value={doc.confidentiality} size="sm" />
                          <StatusBadge type="condition" value={doc.condition} size="sm" />
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td className="px-4 py-3 min-w-[140px] whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60">
                        <StatusBadge type="status" value={doc.status} size="sm" />
                      </td>

                      {/* Column 6: Home Storage Location */}
                      <td className="px-4 py-3 min-w-[260px] whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60">
                        <LocationPathBreadcrumbs locationId={doc.homeLocationId} badgeSize="sm" />
                      </td>

                      {/* Column 7: Current Physical Position */}
                      <td className="px-4 py-3 min-w-[260px] whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60">
                        {isCheckedOut ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/80">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <span>Custody: <strong>{doc.custodianName}</strong></span>
                          </span>
                        ) : (
                          <LocationPathBreadcrumbs locationId={doc.currentLocationId} badgeSize="sm" />
                        )}
                      </td>

                      {/* Column 8: Actions */}
                      <td className="px-4 py-3 min-w-[120px] text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectDocument(doc.id)}
                            className="btn-secondary btn-xs"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocToEdit(doc);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg transition-colors"
                            title="Edit Document Record"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocToDelete({ id: doc.id, number: doc.documentNumber, title: doc.title });
                            }}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="Delete Document Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Column 9: QR Code Claim Status */}
                      <td className="px-4 py-3 min-w-[130px] whitespace-nowrap">
                        {doc.qrClaimed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Claimed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded border border-amber-200 dark:border-amber-800/50">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            Unclaimed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedDocs.map(doc => {
            const isSelected = selectedDocIds.includes(doc.id);
            const parentBundle = bundles.find(b => b.documentIds.includes(doc.id) || b.id === doc.bundleId || b.bundleNumber === doc.bundleNumber);

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className={`p-5 rounded-2xl border shadow-sm transition-all cursor-pointer space-y-3 relative ${
                  isSelected 
                    ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-teal-300 dark:hover:border-teal-700/80'
                }`}
              >
                {doc.photos?.[0] && (
                  <img src={doc.photos[0].url} alt="" className="h-36 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleSelectDoc(doc.id, e as any)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                        #{doc.documentNumber}
                      </span>
                      <p className="text-[10px] text-zinc-400 uppercase font-mono">{doc.documentTypeName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge type="status" value={doc.status} size="sm" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocToEdit(doc);
                      }}
                      className="p-1 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded transition-colors"
                      title="Edit Document Record"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocToDelete({ id: doc.id, number: doc.documentNumber, title: doc.title });
                      }}
                      className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-colors"
                      title="Delete Document Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bundle Badge */}
                {(doc.bundleNumber || parentBundle) && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                      <Layers className="w-3 h-3 text-amber-600" />
                      <span>{doc.bundleNumber || parentBundle?.bundleNumber}</span>
                    </span>
                  </div>
                )}

                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm line-clamp-2">
                  {doc.title || 'Untitled draft'}
                </h3>
                {doc.status === 'DRAFT' && <StatusBadge type="status" value="DRAFT" size="sm" />}

                {doc.customFieldValues && Object.keys(doc.customFieldValues).length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.entries(doc.customFieldValues).map(([key, val]) => (
                      <span 
                        key={key} 
                        className="inline-flex items-center gap-1 text-[10px] font-semibold bg-teal-50/80 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded border border-teal-200/80 dark:border-teal-800/60"
                      >
                        <span className="text-zinc-400 font-normal">{key}:</span> {val}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Home Archive Storage:</span>
                      <LocationPathBreadcrumbs locationId={doc.homeLocationId} badgeSize="sm" />
                    </div>
                    {/* QR Claim Status */}
                    {doc.qrClaimed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle2 className="w-3 h-3" />
                        Claimed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                        <Clock className="w-3 h-3" />
                        Unclaimed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Pagination Controls */}
      {filteredDocs.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none font-medium"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="sm:ml-2">
              Page <strong className="text-zinc-900 dark:text-zinc-100">{safePage}</strong> of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={safePage === 1}
              title="First page"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              title="Previous page"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {getPageNumbers().map(p => (
              typeof p === 'number' ? (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  className={`min-w-[30px] px-2 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    p === safePage
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {p}
                </button>
              ) : (
                <span key={p} className="px-1 text-xs text-zinc-400">…</span>
              )
            ))}

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              title="Next page"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={safePage === totalPages}
              title="Last page"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Register New Physical Document Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Register New Physical Document
                </h3>
                {sessionCount > 0 && (
                  <span className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    {sessionCount} this session
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                disabled={isRegistering}
                className="text-zinc-400 hover:text-zinc-600 p-1 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="flex-1 flex flex-col min-h-0">
              <div ref={regFormBodyRef} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">

              {lastSavedNumber && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  Registered #{lastSavedNumber} — department, type and location kept. Enter the next record.
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Document Number (Optional - Auto-generated if blank)
                  </label>
                  <input
                    type="text"
                    value={regDocNumber}
                    onChange={(e) => setRegDocNumber(e.target.value)}
                    placeholder="e.g. ENG-ARCH-0001"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none font-mono"
                  />
                  {!regDocNumber.trim() && autoNumberPreview && (
                    <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                      Auto-generate: <span className="font-bold text-teal-500">{autoNumberPreview}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={regRefNumber}
                    onChange={(e) => setRegRefNumber(e.target.value)}
                    placeholder="e.g. REF-ENG-2026-001"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Document Title *
                </label>
                <input
                  ref={regTitleRef}
                  type="text"
                  required
                  value={regTitle}
                  onChange={(e) => setRegTitle(e.target.value)}
                  placeholder="Official title or title on cover binder..."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none font-medium"
                />
              </div>

              {/* Requirement 4: Owning Department tied to Document Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Owning Department *
                  </label>
                  <select
                    required
                    value={regDeptId}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none font-semibold"
                  >
                    <option value="">Select department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                    <span>Document Type *</span>
                    <span className="text-[10px] text-teal-600 font-normal">
                      (Tied to Department)
                    </span>
                  </label>
                  <DocumentTypeCombobox
                    options={availableDocTypesForDept}
                    value={regTypeId}
                    onChange={handleTypeChange}
                    emptyMessage="No types tied to this department (Create in Settings)"
                  />
                </div>
              </div>

              {/* Dynamic Custom Fields Section tied to Document Type */}
              {(() => {
                const selectedDocType = documentTypes.find(dt => dt.id === regTypeId);
                if (!selectedDocType?.customFields || selectedDocType.customFields.length === 0) return null;

                return (
                  <div className="p-4 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        Custom Classification Fields for {selectedDocType.name}
                      </label>
                      <span className="text-[10px] text-teal-700 dark:text-teal-300 font-medium">
                        Differentiates documents with identical titles
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedDocType.customFields.map(field => (
                        <div key={field.id} className="space-y-1">
                          <label className="block font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                          </label>

                          {field.type === 'select' ? (
                            <select
                              required={field.required}
                              value={String(regCustomValues[field.name] ?? '')}
                              onChange={(e) => setRegCustomValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-800 rounded-xl outline-none font-medium"
                            >
                              <option value="">-- Select {field.label} --</option>
                              {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                              required={field.required}
                              value={String(regCustomValues[field.name] ?? '')}
                              placeholder={field.placeholder || `Enter ${field.label}...`}
                              onChange={(e) => setRegCustomValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-800 rounded-xl outline-none font-medium"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Disambiguation Identifier Live Preview */}
                    <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-teal-200 dark:border-teal-800/80 text-[11px] text-zinc-800 dark:text-zinc-200 space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                        Unique Document Classification Preview:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap font-semibold">
                        <span className="text-teal-900 dark:text-teal-200">{regTitle || '[Document Title]'}</span>
                        {Object.entries(regCustomValues).filter(([_, val]) => Boolean(val)).map(([key, val]) => (
                          <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[10px]">
                            <span className="text-zinc-500 font-normal">{key}:</span> {val}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* PRD MANDATE: Home Location Assignment */}
              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-xl space-y-1.5">
                <label className="block font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider text-[11px]">
                  📍 Assign Permanent Home Storage Location *
                </label>
                <p className="text-[11px] text-teal-800 dark:text-teal-300">
                  Select the exact folder, box, shelf, or cabinet where this physical document belongs in the archive vault.
                </p>
                <select
                  required
                  value={regHomeLocationId}
                  onChange={(e) => setRegHomeLocationId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-teal-300 dark:border-teal-700 rounded-xl outline-none font-medium"
                >
                  <option value="">Select home location</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Confidentiality
                  </label>
                  <select
                    value={regConfidentiality}
                    onChange={(e) => setRegConfidentiality(e.target.value as ConfidentialityLevel)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CONFIDENTIAL">Confidential</option>
                    <option value="RESTRICTED">Restricted</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Physical Condition
                  </label>
                  <select
                    value={regCondition}
                    onChange={(e) => setRegCondition(e.target.value as DocumentCondition)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none"
                  >
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Document Date
                  </label>
                  <input
                    type="date"
                    value={regDocDate}
                    onChange={(e) => setRegDocDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Subject / Summary Description
                </label>
                <textarea
                  value={regDescription}
                  onChange={(e) => setRegDescription(e.target.value)}
                  rows={2}
                  placeholder="Summary of document scope and key stipulations..."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none resize-none"
                />
              </div>

              {/* Optional Digital Surrogate Copy Section */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={regHasDigitalCopy}
                    onChange={(e) => setRegHasDigitalCopy(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <span>Attach Digitized Surrogate Scan Copy (PDF)</span>
                </label>

                {regHasDigitalCopy && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2 animate-in fade-in">
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Digitized PDF File Name
                    </label>
                    <input
                      type="text"
                      value={regDigitalFileName}
                      onChange={(e) => setRegDigitalFileName(e.target.value)}
                      placeholder="e.g. Contract_2026_Scan.pdf"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              </div>

              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={isRegistering}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={() => { submitModeRef.current = 'close'; }}
                  disabled={isRegistering}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save & close
                </button>
                <button
                  type="submit"
                  onClick={() => { submitModeRef.current = 'next'; }}
                  disabled={isRegistering}
                  className="px-5 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-xl font-semibold shadow-md shadow-teal-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRegistering ? 'Saving...' : 'Save & register next'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Bulk Document Tag Printing Modal */}
      {showBulkPrintModal && (
        <BulkTagPrintModal
          documents={selectedDocuments}
          onClose={() => setShowBulkPrintModal(false)}
        />
      )}

      {/* Bulk Grouping / Bundle Modal */}
      {showBundleModal && (
        <BundleModal
          selectedDocuments={selectedDocuments}
          onClose={() => setShowBundleModal(false)}
          onSuccess={() => {
            setSelectedDocIds([]);
          }}
        />
      )}

      {/* Bulk Metadata Update Modal (Security & Condition / Department) */}
      <BulkUpdateModal
        isOpen={bulkUpdateMode !== null}
        mode={bulkUpdateMode || 'security'}
        documentIds={selectedDocIds}
        onClose={() => setBulkUpdateMode(null)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={async () => {
          if (isBulkDeleting) return;
          setIsBulkDeleting(true);
          try {
            await bulkDeleteDocuments(selectedDocIds);
            setSelectedDocIds([]);
            setShowBulkDeleteConfirm(false);
          } finally {
            setIsBulkDeleting(false);
          }
        }}
        title="Bulk Delete Registered Documents"
        message={`Are you sure you want to permanently delete ${selectedDocIds.length} document record(s)? Records currently checked out will be skipped. This operation cannot be undone.`}
        confirmText={isBulkDeleting ? 'Deleting...' : 'Delete All Permanently'}
        variant="danger"
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(docToDelete)}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => {
          if (docToDelete) {
            deleteDocument(docToDelete.id);
            setDocToDelete(null);
          }
        }}
        title="Delete Registered Document Record"
        message={`Are you sure you want to permanently delete document #${docToDelete?.number || ''} (${docToDelete?.title || ''})? This operation will remove the record from the physical repository catalogue.`}
        confirmText="Delete Permanently"
        variant="danger"
      />

      {/* Edit Document Modal */}
      <EditDocumentModal
        document={docToEdit}
        isOpen={Boolean(docToEdit)}
        onClose={() => setDocToEdit(null)}
      />

    </div>
  );
};
