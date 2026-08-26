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
  ChevronsRight
} from 'lucide-react';
import { DocumentStatus, ConfidentialityLevel, DocumentCondition, DocumentItem } from '../types';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { DocumentTypeCombobox } from '../components/common/DocumentTypeCombobox';
import { BulkTagPrintModal } from '../components/documents/BulkTagPrintModal';
import { BulkUpdateModal } from '../components/documents/BulkUpdateModal';
import { BundleModal } from '../components/documents/BundleModal';
import { EditDocumentModal } from '../components/documents/EditDocumentModal';

interface DocumentsPageProps {
  onSelectDocument: (docId: string) => void;
  openRegisterModalDirectly?: boolean;
  onClearTrigger?: () => void;
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
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

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
  const [regDeptId, setRegDeptId] = useState(departments[0]?.id || '');
  
  // Filter available document types based on selected Owning Department
  const availableDocTypesForDept = documentTypes.filter(
    dt => !dt.departmentId || dt.departmentId === 'ALL' || dt.departmentId === regDeptId
  );

  const [regTypeId, setRegTypeId] = useState(availableDocTypesForDept[0]?.id || documentTypes[0]?.id || '');
  const [regHomeLocationId, setRegHomeLocationId] = useState(locations[0]?.id || '');

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
  }, [showRegisterModal, regDeptId, regTypeId, regDocNumber, getNextDocumentNumber]);
  const [regSubject, setRegSubject] = useState('');
  const [regDescription, setRegDescription] = useState('');
  const [regConfidentiality, setRegConfidentiality] = useState<ConfidentialityLevel>('CONFIDENTIAL');
  const [regCondition, setRegCondition] = useState<DocumentCondition>('EXCELLENT');
  const [regDocDate, setRegDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [regHasDigitalCopy, setRegHasDigitalCopy] = useState(false);
  const [regDigitalFileName, setRegDigitalFileName] = useState('');
  const [regCustomValues, setRegCustomValues] = useState<Record<string, string | number>>({});

  // When regDeptId changes, only load Document Types tied to this Owning Department
  const handleDeptChange = (newDeptId: string) => {
    setRegDeptId(newDeptId);
    const validTypes = documentTypes.filter(
      dt => !dt.departmentId || dt.departmentId === 'ALL' || dt.departmentId === newDeptId
    );
    if (validTypes.length > 0) {
      handleTypeChange(validTypes[0].id);
    } else {
      setRegTypeId('');
      setRegCustomValues({});
    }
  };

  useEffect(() => {
    const validTypes = documentTypes.filter(
      dt => !dt.departmentId || dt.departmentId === 'ALL' || dt.departmentId === regDeptId
    );
    if (validTypes.length > 0 && (!regTypeId || !validTypes.some(dt => dt.id === regTypeId))) {
      handleTypeChange(validTypes[0].id);
    }
  }, [documentTypes, regDeptId]);

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

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTitle.trim() || !regHomeLocationId || !regTypeId) return;

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

    addDocument({
      documentNumber: docNum,
      referenceNumber: regRefNumber.trim() || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
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
      customFieldValues: regCustomValues
    });

    // Reset
    setRegDocNumber('');
    setRegRefNumber('');
    setRegTitle('');
    setRegSubject('');
    setRegDescription('');
    setRegHasDigitalCopy(false);
    setRegDigitalFileName('');
    setRegCustomValues({});
    setShowRegisterModal(false);
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
        doc.referenceNumber.toLowerCase().includes(q) ||
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
  }, [globalSearchQuery, selectedDept, selectedType, selectedStatus, selectedConf, selectedBundleFilter, filterDateFrom, filterDateTo, viewMode]);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Master Archive Document Catalogue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Physical record registry with complete dual-location tracking & digital attachments
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegisterModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Register New Physical Document
        </button>
      </div>

      {/* Filter Control Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          
          {/* Keyword Search */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search Doc #, Title, Ref..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Document Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
            >
              <option value="ALL">All Document Types</option>
              {documentTypes.map(dt => (
                <option key={dt.id} value={dt.id}>{dt.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="REQUESTED">Requested</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Bundle / Dossier Filter */}
          <div>
            <select
              value={selectedBundleFilter}
              onChange={(e) => setSelectedBundleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium text-amber-700 dark:text-amber-400 font-semibold"
            >
              <option value="ALL">All Bundles & Single Items</option>
              <option value="BUNDLED">📦 Only Bundled Records</option>
              <option value="UNBUNDLED">📄 Only Unbundled Records</option>
              {bundles.map(b => (
                <option key={b.id} value={b.id}>
                  Dossier: {b.bundleNumber} ({b.title.slice(0, 20)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Confidentiality Filter */}
          <div>
            <select
              value={selectedConf}
              onChange={(e) => setSelectedConf(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
            >
              <option value="ALL">All Confidentiality</option>
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="RESTRICTED">Restricted</option>
            </select>
          </div>

          {/* Date Registered Filter */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5" />
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
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  });
                })()}
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] outline-none"
                  title="From date"
                />
                <span className="text-[10px] text-slate-400 font-bold">→</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] outline-none"
                  title="To date"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    type="button"
                    onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    title="Clear date filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Results Bar & View Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-900 dark:text-slate-100">{rangeStart}–{rangeEnd}</strong> of <strong className="text-slate-900 dark:text-slate-100">{filteredDocs.length}</strong> filtered records ({documents.length} total)
            </span>
            {selectedDocIds.length > 0 && (
              <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                {selectedDocIds.length} item(s) selected
              </span>
            )}
            {filteredDocs.length > 0 && selectedDocIds.length < filteredDocs.length && paginatedDocs.length > 0 && paginatedDocs.every(d => selectedDocIds.includes(d.id)) && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
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
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-400'
                    : 'border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700'
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
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-400'
                  : 'border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg border ${
                viewMode === 'grid'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-400'
                  : 'border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* BULK ACTIONS BANNER (Appears when 1 or more documents are selected) */}
      {selectedDocIds.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-lg border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {selectedDocIds.length}
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                <span>{selectedDocIds.length} Physical Record(s) Selected for Bulk Operations</span>
              </div>
              <p className="text-[11px] text-indigo-200">
                Batch tag printing, dossier grouping, bulk metadata updates or bulk deletion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            {/* Action 1: Print Document Tags all at once */}
            <button
              type="button"
              onClick={() => setShowBulkPrintModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document Tags ({selectedDocIds.length})</span>
            </button>

            {/* Action 2: Bundle / Group selected items */}
            <button
              type="button"
              onClick={() => setShowBundleModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bundle / Group Selected</span>
            </button>

            {/* Action 3: Bulk update Security & Condition */}
            <button
              type="button"
              onClick={() => setBulkUpdateMode('security')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Security & Condition</span>
            </button>

            {/* Action 4: Bulk change Department */}
            <button
              type="button"
              onClick={() => setBulkUpdateMode('department')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Change Department</span>
            </button>

            {/* Action 5: Bulk Delete */}
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedDocIds.length})</span>
            </button>

            {/* Clear Selection */}
            <button
              type="button"
              onClick={() => setSelectedDocIds([])}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-xs font-medium transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Table / Grid Results View */}
      <div ref={resultsTopRef} className="scroll-mt-24">
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase font-mono font-bold tracking-wider">
                <tr>
                  {/* Select All Checkbox */}
                  <th className={`px-3 py-3.5 w-10 text-center border-r border-slate-200/80 dark:border-slate-800/80 ${frozenCol ? 'sticky left-0 z-30 bg-slate-100 dark:bg-slate-800/80' : ''}`}>
                    <input
                      type="checkbox"
                      checked={paginatedDocs.length > 0 && paginatedDocs.every(d => selectedDocIds.includes(d.id))}
                      onChange={handleToggleSelectPage}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Select / Deselect Current Page"
                    />
                  </th>
                  {/* Column 1: Title & Subject */}
                  <th className={`border-r border-slate-200/80 dark:border-slate-800/80 min-w-[240px] max-w-[320px] px-4 py-3.5 ${frozenCol ? 'sticky left-[40px] z-20 bg-slate-100 dark:bg-slate-800/80 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]' : ''}`}>
                    Title & Subject
                  </th>
                  <th className="px-4 py-3.5 min-w-[170px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">Doc & Ref #</th>
                  <th className="px-4 py-3.5 min-w-[160px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">Department</th>
                  <th className="px-4 py-3.5 min-w-[190px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">Security & Condition</th>
                  <th className="px-4 py-3.5 min-w-[140px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">Circulation Status</th>
                  <th className="px-4 py-3.5 min-w-[260px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">Home Storage Location</th>
                  <th className="px-4 py-3.5 min-w-[260px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">Current Physical Position</th>
                  <th className="px-4 py-3.5 min-w-[100px] text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 font-medium">
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
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40' 
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td 
                        className={`px-3 py-3 w-10 text-center border-r border-slate-200/60 dark:border-slate-800/60 ${frozenCol ? `sticky left-0 z-30 ${isSelected ? 'bg-indigo-50/90 dark:bg-indigo-950/60' : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50/90 dark:group-hover:bg-slate-800/60'}` : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectDoc(doc.id, e as any)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Column 1: Title & Subject */}
                      <td 
                        className={`border-r border-slate-200/80 dark:border-slate-800/80 min-w-[240px] max-w-[320px] px-4 py-3 ${frozenCol ? `sticky left-[40px] z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] ${isSelected ? 'bg-indigo-50/90 dark:bg-indigo-950/60' : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50/90 dark:group-hover:bg-slate-800/60'}` : ''}`}
                        title={doc.title}
                      >
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {doc.title}
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
                                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/60"
                                title={`${key}: ${val}`}
                              >
                                <span className="text-slate-400 font-normal">{key}:</span> {val}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
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
                      <td className="px-4 py-3 min-w-[170px] whitespace-nowrap border-r border-slate-200/60 dark:border-slate-800/60">
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          #{doc.documentNumber}
                        </div>
                        {doc.referenceNumber && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Ref: {doc.referenceNumber}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {doc.documentTypeName}
                        </div>
                      </td>

                      {/* Column 3: Department */}
                      <td className="px-4 py-3 min-w-[160px] whitespace-nowrap border-r border-slate-200/60 dark:border-slate-800/60">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                          {doc.departmentName}
                        </span>
                      </td>

                      {/* Column 4: Security & Condition */}
                      <td className="px-4 py-3 min-w-[190px] whitespace-nowrap border-r border-slate-200/60 dark:border-slate-800/60">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge type="confidentiality" value={doc.confidentiality} size="sm" />
                          <StatusBadge type="condition" value={doc.condition} size="sm" />
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td className="px-4 py-3 min-w-[140px] whitespace-nowrap border-r border-slate-200/60 dark:border-slate-800/60">
                        <StatusBadge type="status" value={doc.status} size="sm" />
                      </td>

                      {/* Column 6: Home Storage Location */}
                      <td className="px-4 py-3 min-w-[260px] whitespace-nowrap border-r border-slate-200/60 dark:border-slate-800/60">
                        <LocationPathBreadcrumbs locationId={doc.homeLocationId} badgeSize="sm" />
                      </td>

                      {/* Column 7: Current Physical Position */}
                      <td className="px-4 py-3 min-w-[260px] whitespace-nowrap border-r border-slate-200/60 dark:border-slate-800/60">
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
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg font-semibold text-xs transition-colors shadow-xs"
                          >
                            Inspect →
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocToEdit(doc);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
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
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="Delete Document Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleSelectDoc(doc.id, e as any)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        #{doc.documentNumber}
                      </span>
                      <p className="text-[10px] text-slate-400 uppercase font-mono">{doc.documentTypeName}</p>
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
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-colors"
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
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-colors"
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

                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-2">
                  {doc.title}
                </h3>

                {doc.customFieldValues && Object.keys(doc.customFieldValues).length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.entries(doc.customFieldValues).map(([key, val]) => (
                      <span 
                        key={key} 
                        className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/60"
                      >
                        <span className="text-slate-400 font-normal">{key}:</span> {val}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Home Archive Storage:</span>
                    <LocationPathBreadcrumbs locationId={doc.homeLocationId} badgeSize="sm" />
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-medium"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="sm:ml-2">
              Page <strong className="text-slate-900 dark:text-slate-100">{safePage}</strong> of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={safePage === 1}
              title="First page"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              title="Previous page"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              ) : (
                <span key={p} className="px-1 text-xs text-slate-400">…</span>
              )
            ))}

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              title="Next page"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={safePage === totalPages}
              title="Last page"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Register New Physical Document Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  Register New Physical Document
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Document Number (Optional - Auto-generated if blank)
                  </label>
                  <input
                    type="text"
                    value={regDocNumber}
                    onChange={(e) => setRegDocNumber(e.target.value)}
                    placeholder="e.g. ENG-ARCH-0001"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  />
                  {!regDocNumber.trim() && autoNumberPreview && (
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Auto-generate: <span className="font-bold text-indigo-500">{autoNumberPreview}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={regRefNumber}
                    onChange={(e) => setRegRefNumber(e.target.value)}
                    placeholder="e.g. REF-ENG-2026-001"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={regTitle}
                  onChange={(e) => setRegTitle(e.target.value)}
                  placeholder="Official title or title on cover binder..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                />
              </div>

              {/* Requirement 4: Owning Department tied to Document Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Owning Department *
                  </label>
                  <select
                    value={regDeptId}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-semibold"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Document Type *</span>
                    <span className="text-[10px] text-indigo-600 font-normal">
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
                  <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Custom Classification Fields for {selectedDocType.name}
                      </label>
                      <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                        Differentiates documents with identical titles
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedDocType.customFields.map(field => (
                        <div key={field.id} className="space-y-1">
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                          </label>

                          {field.type === 'select' ? (
                            <select
                              required={field.required}
                              value={String(regCustomValues[field.name] ?? '')}
                              onChange={(e) => setRegCustomValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl outline-none font-medium"
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
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl outline-none font-medium"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Disambiguation Identifier Live Preview */}
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800/80 text-[11px] text-slate-800 dark:text-slate-200 space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                        Unique Document Classification Preview:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap font-semibold">
                        <span className="text-indigo-900 dark:text-indigo-200">{regTitle || '[Document Title]'}</span>
                        {Object.entries(regCustomValues).filter(([_, val]) => Boolean(val)).map(([key, val]) => (
                          <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 text-[10px]">
                            <span className="text-slate-500 font-normal">{key}:</span> {val}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* PRD MANDATE: Home Location Assignment */}
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl space-y-1.5">
                <label className="block font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-[11px]">
                  📍 Assign Permanent Home Storage Location *
                </label>
                <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                  Select the exact folder, box, shelf, or cabinet where this physical document belongs in the archive vault.
                </p>
                <select
                  required
                  value={regHomeLocationId}
                  onChange={(e) => setRegHomeLocationId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl outline-none font-medium"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confidentiality
                  </label>
                  <select
                    value={regConfidentiality}
                    onChange={(e) => setRegConfidentiality(e.target.value as ConfidentialityLevel)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CONFIDENTIAL">Confidential</option>
                    <option value="RESTRICTED">Restricted</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Physical Condition
                  </label>
                  <select
                    value={regCondition}
                    onChange={(e) => setRegCondition(e.target.value as DocumentCondition)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Document Date
                  </label>
                  <input
                    type="date"
                    value={regDocDate}
                    onChange={(e) => setRegDocDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Summary Description
                </label>
                <textarea
                  value={regDescription}
                  onChange={(e) => setRegDescription(e.target.value)}
                  rows={2}
                  placeholder="Summary of document scope and key stipulations..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none resize-none"
                />
              </div>

              {/* Optional Digital Surrogate Copy Section */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={regHasDigitalCopy}
                    onChange={(e) => setRegHasDigitalCopy(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>Attach Digitized Surrogate Scan Copy (PDF)</span>
                </label>

                {regHasDigitalCopy && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Digitized PDF File Name
                    </label>
                    <input
                      type="text"
                      value={regDigitalFileName}
                      onChange={(e) => setRegDigitalFileName(e.target.value)}
                      placeholder="e.g. Contract_2026_Scan.pdf"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  Register Record
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
