import React, { useState, useMemo, useEffect } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { DocumentBundle, DocumentItem } from '../types';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { QRBarcodeModal } from '../components/common/QRBarcodeModal';
import { BundleModal } from '../components/documents/BundleModal';
import { BatchRelocateModal } from '../components/scanner/BatchRelocateModal';
import { ScanFillBundleModal } from '../components/scanner/ScanFillBundleModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PageHeader } from '../components/common/PageHeader';
import { PhotoUploader } from '../components/common/PhotoUploader';
import {
  Layers,
  Search,
  ChevronDown,
  ChevronRight,
  Truck,
  QrCode,
  Edit3,
  Trash2,
  FileText,
  Package,
  CheckCircle2,
  Archive,
  Lock,
  ArrowRightLeft,
  Filter,
  Eye,
  X,
  ImageIcon,
  Plus,
  ScanLine
} from 'lucide-react';

export const BundlesPage: React.FC = () => {
  const {
    bundles,
    documents,
    departments,
    deleteBundle,
    updateBundle,
    calculatePath,
    addNotification,
    setActiveTab
  } = useArchive();

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedBundleIds, setExpandedBundleIds] = useState<Set<string>>(new Set());

  // Modal states
  const [editingBundle, setEditingBundle] = useState<DocumentBundle | null>(null);
  const [qrModalBundle, setQrModalBundle] = useState<DocumentBundle | null>(null);
  const [relocatingBundle, setRelocatingBundle] = useState<DocumentBundle | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DocumentBundle | null>(null);

  // Empty-bundle creation + scan-to-fill flow
  const [showNewBundleModal, setShowNewBundleModal] = useState(false);
  const [scanFillingBundle, setScanFillingBundle] = useState<DocumentBundle | null>(null);

  // Selected documents within expanded bundles (for bulk relocate)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Hover preview for bundle images
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string; x: number; y: number } | null>(null);

  const PREVIEW_WIDTH = 288;
  const PREVIEW_HEIGHT = 320;

  const showImagePreview = (e: React.MouseEvent<HTMLElement>, bundle: DocumentBundle) => {
    if (!bundle.imageUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.right + 12;
    if (x + PREVIEW_WIDTH > window.innerWidth - 8) {
      x = rect.left - PREVIEW_WIDTH - 12;
    }
    if (x < 8) x = 8;
    let y = rect.top + rect.height / 2 - PREVIEW_HEIGHT / 2;
    y = Math.max(8, Math.min(y, window.innerHeight - PREVIEW_HEIGHT - 8));
    setImagePreview({ src: bundle.imageUrl, title: `${bundle.bundleNumber} — ${bundle.title}`, x, y });
  };

  const hideImagePreview = () => setImagePreview(null);

  // Filtering logic
  const filteredBundles = useMemo(() => {
    let result = bundles;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        b.bundleNumber.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.departmentName.toLowerCase().includes(q) ||
        b.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (statusFilter) {
      result = result.filter(b => b.status === statusFilter);
    }
    return result;
  }, [bundles, searchQuery, statusFilter]);

  // Stats
  const totalBundles = bundles.length;
  const activeBundles = bundles.filter(b => b.status === 'ACTIVE').length;
  const archivedBundles = bundles.filter(b => b.status === 'ARCHIVED').length;
  const sealedBundles = bundles.filter(b => b.status === 'SEALED').length;
  const totalDocsInBundles = bundles.reduce((acc, b) => acc + b.documentIds.length, 0);

  // Helpers
  const toggleExpand = (bundleId: string) => {
    setExpandedBundleIds(prev => {
      const next = new Set(prev);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  };

  const getBundleDocuments = (bundle: DocumentBundle): DocumentItem[] => {
    return bundle.documentIds
      .map(id => documents.find(d => d.id === id))
      .filter((d): d is DocumentItem => d !== undefined);
  };

  const getBundleStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="chip rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="chip rounded-full text-xs bg-zinc-100 text-zinc-600 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400">
            <Archive className="w-3 h-3" /> Archived
          </span>
        );
      case 'SEALED':
        return (
          <span className="chip rounded-full text-xs bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/50">
            <Lock className="w-3 h-3" /> Sealed
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className="chip rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50">
            <ArrowRightLeft className="w-3 h-3" /> Checked Out
          </span>
        );
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-100 text-zinc-600">{status}</span>;
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const selectAllBundleDocs = (bundle: DocumentBundle) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      const allSelected = bundle.documentIds.every(id => prev.has(id));
      if (allSelected) {
        bundle.documentIds.forEach(id => next.delete(id));
      } else {
        bundle.documentIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleEditBundle = async (updates: Partial<DocumentBundle>) => {
    if (!editingBundle) return;
    await updateBundle(editingBundle.id, updates);
    setEditingBundle(null);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      <PageHeader
        icon={Layers}
        title="Bundles"
        description="Group records, manage bundle locations, and track dossier activity."
        actions={
          <button
            type="button"
            onClick={() => setShowNewBundleModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New bundle
          </button>
        }
      />

      {/* KPI Stats Row — clicking a status card applies that filter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          aria-pressed={statusFilter === ''}
          className={`card p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${statusFilter === '' ? 'ring-2 ring-teal-500/40' : ''}`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-500" aria-hidden="true" />
            <span className="meta">Total bundles</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-1">{totalBundles}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? '' : 'ACTIVE')}
          aria-pressed={statusFilter === 'ACTIVE'}
          className={`card p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${statusFilter === 'ACTIVE' ? 'ring-2 ring-teal-500/40' : ''}`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
            <span className="meta">Active</span>
          </div>
          <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{activeBundles}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ARCHIVED' ? '' : 'ARCHIVED')}
          aria-pressed={statusFilter === 'ARCHIVED'}
          className={`card p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${statusFilter === 'ARCHIVED' ? 'ring-2 ring-teal-500/40' : ''}`}
        >
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-zinc-400" aria-hidden="true" />
            <span className="meta">Archived</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-600 dark:text-zinc-400 mt-1">{archivedBundles}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'SEALED' ? '' : 'SEALED')}
          aria-pressed={statusFilter === 'SEALED'}
          className={`card p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${statusFilter === 'SEALED' ? 'ring-2 ring-teal-500/40' : ''}`}
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-violet-500" aria-hidden="true" />
            <span className="meta">Sealed</span>
          </div>
          <p className="text-2xl font-semibold text-violet-600 dark:text-violet-400 mt-1">{sealedBundles}</p>
        </button>
        <div className="card p-3 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-500" aria-hidden="true" />
            <span className="meta">Docs bundled</span>
          </div>
          <p className="text-2xl font-semibold text-sky-600 dark:text-sky-400 mt-1">{totalDocsInBundles}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search bundles by code, title, department, or tags..."
              aria-label="Search bundles"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="input w-auto min-w-[140px]"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
              <option value="SEALED">Sealed</option>
              <option value="CHECKED_OUT">Checked Out</option>
            </select>
          </div>
        </div>

        {(searchQuery || statusFilter) && (
          <div className="flex items-center gap-2 pt-1">
            <span className="meta">
              Showing {filteredBundles.length} of {totalBundles} bundles
            </span>
            {(searchQuery || statusFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter(''); }}
                className="btn btn-ghost btn-xs text-teal-600 dark:text-teal-400"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bundles Table */}
      {filteredBundles.length === 0 ? (
        <div className="card empty-state py-12">
          <Layers className="w-10 h-10 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
          <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
            {bundles.length === 0 ? 'No bundles created yet' : 'No bundles match your search'}
          </h3>
          <p className="max-w-md">
            {bundles.length === 0
              ? 'Create bundles from the Document Catalogue by selecting documents and clicking "Bundle Selected".'
              : 'Try adjusting your search terms or clearing the status filter.'
            }
          </p>
          {bundles.length === 0 && (
            <button
              onClick={() => setActiveTab('documents')}
              className="btn btn-primary btn-sm mt-2"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              Go to Document Catalogue
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="w-10 px-3 py-3 text-center">
                    <span className="sr-only">Expand</span>
                  </th>
                  <th className="w-12 px-2 py-3 text-center">
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-400 mx-auto" />
                  </th>
                  <th className="th">
                    Bundle Code
                  </th>
                  <th className="th">
                    Title & Description
                  </th>
                  <th className="th hidden lg:table-cell">
                    Department
                  </th>
                  <th className="th hidden md:table-cell">
                    Location
                  </th>
                  <th className="th text-center">
                    Docs
                  </th>
                  <th className="th text-center">
                    Status
                  </th>
                  <th className="th text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredBundles.map(bundle => {
                  const isExpanded = expandedBundleIds.has(bundle.id);
                  const bundleDocs = getBundleDocuments(bundle);
                  const allDocsSelected = bundle.documentIds.length > 0 && bundle.documentIds.every(id => selectedDocIds.has(id));

                  return (
                    <React.Fragment key={bundle.id}>
                      {/* Bundle Row */}
                      <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                        {/* Expand Toggle */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggleExpand(bundle.id)}
                            className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        
                        {/* Thumbnail */}
                        <td className="px-2 py-3 text-center">
                          {bundle.imageUrl ? (
                            <img
                              src={bundle.imageUrl}
                              alt={bundle.title}
                              className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm mx-auto cursor-zoom-in"
                              referrerPolicy="no-referrer"
                              onMouseEnter={(e) => showImagePreview(e, bundle)}
                              onMouseLeave={hideImagePreview}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto">
                              <Package className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
                            </div>
                          )}
                        </td>
                        
                        {/* Bundle Code */}
                        <td className="px-3 py-3">
                          <span className="font-mono font-bold text-xs text-teal-600 dark:text-teal-400">
                            {bundle.bundleNumber}
                          </span>
                        </td>

                        {/* Title & Description */}
                        <td className="px-3 py-3 max-w-xs">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {bundle.title}
                          </div>
                          {bundle.description && (
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                              {bundle.description}
                            </div>
                          )}
                          {bundle.tags && bundle.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {bundle.tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
                                >
                                  {tag}
                                </span>
                              ))}
                              {bundle.tags.length > 3 && (
                                <span className="text-[10px] text-zinc-400">+{bundle.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Department */}
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            {bundle.departmentName}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="px-3 py-3 hidden md:table-cell">
                          {bundle.locationId ? (
                            <div className="max-w-[200px]">
                              <LocationPathBreadcrumbs locationId={bundle.locationId} badgeSize="sm" />
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">No location set</span>
                          )}
                        </td>

                        {/* Document Count */}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/50">
                            <FileText className="w-3 h-3" />
                            {bundle.documentIds.length}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 text-center">
                          {getBundleStatusBadge(bundle.status)}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setScanFillingBundle(bundle)}
                              title="Scan Documents In (QR)"
                              aria-label={`Scan documents into ${bundle.bundleNumber}`}
                              className="btn btn-ghost btn-icon btn-xs text-amber-600 dark:text-amber-400"
                            >
                              <ScanLine className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => setRelocatingBundle(bundle)}
                              title="Relocate Bundle"
                              aria-label={`Relocate ${bundle.bundleNumber}`}
                              className="btn btn-ghost btn-icon btn-xs text-emerald-600 dark:text-emerald-400"
                            >
                              <Truck className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => setQrModalBundle(bundle)}
                              title="View / Print QR Code"
                              aria-label={`Print tag for ${bundle.bundleNumber}`}
                              className="btn btn-ghost btn-icon btn-xs text-teal-600 dark:text-teal-400"
                            >
                              <QrCode className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => setEditingBundle(bundle)}
                              title="Edit Bundle"
                              aria-label={`Edit ${bundle.bundleNumber}`}
                              className="btn btn-ghost btn-icon btn-xs"
                            >
                              <Edit3 className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(bundle)}
                              title="Dissolve Bundle"
                              aria-label={`Dissolve ${bundle.bundleNumber}`}
                              className="btn btn-ghost btn-icon btn-xs hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Documents Section */}
                      {isExpanded && (
                        <tr className="bg-zinc-50/60 dark:bg-zinc-800/20">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="ml-8 space-y-2">
                              {/* Expanded header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Documents in this bundle
                                  </span>
                                  <span className="meta">
                                    ({bundleDocs.length} document{bundleDocs.length !== 1 ? 's' : ''})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => selectAllBundleDocs(bundle)}
                                    className="btn btn-ghost btn-xs text-teal-600 dark:text-teal-400"
                                  >
                                    {allDocsSelected ? 'Deselect all' : 'Select all'}
                                  </button>
                                  {bundle.documentIds.some(id => selectedDocIds.has(id)) && (
                                    <button
                                      onClick={() => setRelocatingBundle(bundle)}
                                      className="btn btn-xs bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                      <Truck className="w-3 h-3" aria-hidden="true" />
                                      Relocate selected ({bundle.documentIds.filter(id => selectedDocIds.has(id)).length})
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Mobile location display */}
                              {bundle.locationId && (
                                <div className="md:hidden mb-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                  <span className="meta block mb-1">
                                    Location
                                  </span>
                                  <LocationPathBreadcrumbs locationId={bundle.locationId} badgeSize="sm" />
                                </div>
                              )}

                              {bundleDocs.length === 0 ? (
                                <p className="text-xs text-zinc-400 italic py-2">
                                  No documents found in this bundle.
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {bundleDocs.map(doc => {
                                    const isSelected = selectedDocIds.has(doc.id);
                                    return (
                                      <div
                                        key={doc.id}
                                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                                          isSelected
                                            ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50'
                                            : 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                        }`}
                                        onClick={() => toggleDocSelection(doc.id)}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleDocSelection(doc.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-4 h-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="font-mono text-[11px] font-bold text-teal-600 dark:text-teal-400 min-w-[80px]">
                                          {doc.documentNumber}
                                        </span>
                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                                          {doc.title}
                                        </span>
                                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${
                                          doc.status === 'AVAILABLE'
                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : doc.status === 'CHECKED_OUT'
                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-zinc-100 text-zinc-500'
                                        }`}>
                                          {doc.status.replace('_', ' ')}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('documents');
                                            // Note: Could add document selection callback here
                                          }}
                                          className="btn btn-ghost btn-icon btn-xs shrink-0"
                                          title="View document in catalogue"
                                          aria-label="View document in catalogue"
                                        >
                                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Bundle metadata */}
                              <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-500">
                                {bundle.imageUrl && (
                                  <img
                                    src={bundle.imageUrl}
                                    alt={bundle.title}
                                    className="w-16 h-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 cursor-zoom-in"
                                    referrerPolicy="no-referrer"
                                    onMouseEnter={(e) => showImagePreview(e, bundle)}
                                    onMouseLeave={hideImagePreview}
                                  />
                                )}
                                <span>Created: {new Date(bundle.createdAt).toLocaleDateString()}</span>
                                <span>Updated: {new Date(bundle.updatedAt).toLocaleDateString()}</span>
                                <span className="font-mono">QR: {bundle.qrCode}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hover preview popover for bundle images */}
      {imagePreview && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: imagePreview.x, top: imagePreview.y, width: PREVIEW_WIDTH }}
        >
          <div className="card rounded-xl shadow-lg overflow-hidden">
            <img
              src={imagePreview.src}
              alt={imagePreview.title}
              className="w-full max-h-64 object-contain bg-zinc-50 dark:bg-zinc-800"
              referrerPolicy="no-referrer"
            />
            <div className="px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 border-t border-zinc-100 dark:border-zinc-800 truncate">
              {imagePreview.title}
            </div>
          </div>
        </div>
      )}

      {/* Create Empty Bundle Modal — chains straight into scan-to-fill */}
      {showNewBundleModal && (
        <BundleModal
          selectedDocuments={[]}
          emptyMode
          onClose={() => setShowNewBundleModal(false)}
          onCreated={(created) => {
            setShowNewBundleModal(false);
            setScanFillingBundle(created);
          }}
        />
      )}

      {/* Scan-to-Fill Bundle Modal */}
      <ScanFillBundleModal
        isOpen={!!scanFillingBundle}
        bundle={scanFillingBundle}
        onClose={() => setScanFillingBundle(null)}
      />

      {/* QR/Barcode Modal for Bundle */}
      {qrModalBundle && (
        <QRBarcodeModal
          isOpen={!!qrModalBundle}
          onClose={() => setQrModalBundle(null)}
          title={qrModalBundle.title}
          subtitle={`${qrModalBundle.documentIds.length} documents`}
          qrValue={qrModalBundle.qrCode}
          barcodeValue={qrModalBundle.barcode}
          entityType="DOCUMENT"
          entityCode={qrModalBundle.bundleNumber}
          pathString={qrModalBundle.locationId ? calculatePath(qrModalBundle.locationId) : undefined}
        />
      )}

      {/* Edit Bundle Modal — reuse BundleModal in existing mode by passing the bundle's docs */}
      {editingBundle && (
        <EditBundleInlineModal
          bundle={editingBundle}
          onClose={() => setEditingBundle(null)}
        />
      )}

      {/* Batch Relocate Modal for Bundle */}
      {relocatingBundle && (
        <BatchRelocateModal
          isOpen={!!relocatingBundle}
          onClose={() => setRelocatingBundle(null)}
          bundleId={relocatingBundle.id}
          preselectedDocs={(() => {
            const selectedIds = relocatingBundle.documentIds.filter(id => selectedDocIds.has(id));
            if (selectedIds.length > 0) {
              return selectedIds
                .map(id => documents.find(d => d.id === id))
                .filter((d): d is DocumentItem => d !== undefined);
            }
            return getBundleDocuments(relocatingBundle);
          })()}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={async () => {
            await deleteBundle(deleteConfirm.id);
            setDeleteConfirm(null);
          }}
          title="Dissolve Bundle"
          message={`Are you sure you want to dissolve bundle "${deleteConfirm.bundleNumber} — ${deleteConfirm.title}"? This will remove the bundle dossier but will NOT delete the documents inside it. The ${deleteConfirm.documentIds.length} document(s) will simply be unlinked from this bundle.`}
          confirmText="Dissolve Bundle"
          variant="danger"
        />
      )}
    </div>
  );
};

/* ─── Inline Edit Modal ─────────────────────────────────────────────── */

interface EditBundleInlineModalProps {
  bundle: DocumentBundle;
  onClose: () => void;
}

const EditBundleInlineModal: React.FC<EditBundleInlineModalProps> = ({ bundle, onClose }) => {
  const { updateBundle, departments, locations, calculatePath } = useArchive();
  const [title, setTitle] = useState(bundle.title);
  const [description, setDescription] = useState(bundle.description || '');
  const [departmentId, setDepartmentId] = useState(bundle.departmentId);
  const [locationId, setLocationId] = useState(bundle.locationId || '');
  const [status, setStatus] = useState(bundle.status);
  const [imageUrl, setImageUrl] = useState(bundle.imageUrl || '');
  const [saving, setSaving] = useState(false);

  const dept = departments.find(d => d.id === departmentId);

  const handleSave = async () => {
    setSaving(true);
    const updates: Partial<DocumentBundle> = {
      title,
      description: description || undefined,
      departmentId,
      departmentName: dept?.name || bundle.departmentName,
      locationId: locationId || undefined,
      locationPath: locationId ? calculatePath(locationId) : undefined,
      status,
      imageUrl: imageUrl.trim() || undefined
    };

    await updateBundle(bundle.id, updates);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Edit bundle">
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h3 className="section-title">Edit bundle</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-xs">
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{bundle.bundleNumber}</span>
            <span className="text-zinc-500 ml-2">{bundle.documentIds.length} document(s)</span>
          </div>

          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="input resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Department</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="input"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as DocumentBundle['status'])}
                className="input"
              >
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
                <option value="SEALED">Sealed</option>
                <option value="CHECKED_OUT">Checked Out</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">
              Storage Location
            </label>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="input"
            >
              <option value="">— No location set —</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{calculatePath(l.id)}</option>
              ))}
            </select>
          </div>

          <PhotoUploader
            value={imageUrl}
            onChange={setImageUrl}
            label="Bundle / Dossier Photo"
          />
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
