import React, { useState, useMemo, useEffect } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { DocumentBundle, DocumentItem } from '../types';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { QRBarcodeModal } from '../components/common/QRBarcodeModal';
import { BundleModal } from '../components/documents/BundleModal';
import { BatchRelocateModal } from '../components/scanner/BatchRelocateModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
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
  ImageIcon
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400">
            <Archive className="w-3 h-3" /> Archived
          </span>
        );
      case 'SEALED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50">
            <Lock className="w-3 h-3" /> Sealed
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50">
            <ArrowRightLeft className="w-3 h-3" /> Checked Out
          </span>
        );
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">{status}</span>;
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
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Bundle & Dossier Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage document bundles, relocate dossiers, and track bundle locations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Bundles</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{totalBundles}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active</span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{activeBundles}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Archived</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-600 dark:text-slate-400 mt-1">{archivedBundles}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sealed</span>
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{sealedBundles}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Docs Bundled</span>
          </div>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{totalDocsInBundles}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search bundles by code, title, department, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-200 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 min-w-[140px]"
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
            <span className="text-xs text-slate-500">
              Showing {filteredBundles.length} of {totalBundles} bundles
            </span>
            {(searchQuery || statusFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter(''); }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bundles Table */}
      {filteredBundles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">
            {bundles.length === 0 ? 'No Bundles Created Yet' : 'No Bundles Match Your Search'}
          </h3>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
            {bundles.length === 0
              ? 'Create bundles from the Document Catalogue by selecting documents and clicking "Bundle Selected".'
              : 'Try adjusting your search terms or clearing the status filter.'
            }
          </p>
          {bundles.length === 0 && (
            <button
              onClick={() => setActiveTab('documents')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Go to Document Catalogue
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="w-10 px-3 py-3 text-center">
                    <span className="sr-only">Expand</span>
                  </th>
                  <th className="w-12 px-2 py-3 text-center">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400 mx-auto" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Bundle Code
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Title & Description
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                    Department
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                    Location
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Docs
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBundles.map(bundle => {
                  const isExpanded = expandedBundleIds.has(bundle.id);
                  const bundleDocs = getBundleDocuments(bundle);
                  const allDocsSelected = bundle.documentIds.length > 0 && bundle.documentIds.every(id => selectedDocIds.has(id));

                  return (
                    <React.Fragment key={bundle.id}>
                      {/* Bundle Row */}
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        {/* Expand Toggle */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggleExpand(bundle.id)}
                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm mx-auto cursor-zoom-in"
                              referrerPolicy="no-referrer"
                              onMouseEnter={(e) => showImagePreview(e, bundle)}
                              onMouseLeave={hideImagePreview}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto">
                              <Package className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            </div>
                          )}
                        </td>
                        
                        {/* Bundle Code */}
                        <td className="px-3 py-3">
                          <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                            {bundle.bundleNumber}
                          </span>
                        </td>

                        {/* Title & Description */}
                        <td className="px-3 py-3 max-w-xs">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {bundle.title}
                          </div>
                          {bundle.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {bundle.description}
                            </div>
                          )}
                          {bundle.tags && bundle.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {bundle.tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                                >
                                  {tag}
                                </span>
                              ))}
                              {bundle.tags.length > 3 && (
                                <span className="text-[10px] text-slate-400">+{bundle.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Department */}
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="text-xs text-slate-600 dark:text-slate-400">
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
                            <span className="text-xs text-slate-400 italic">No location set</span>
                          )}
                        </td>

                        {/* Document Count */}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50">
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
                              onClick={() => setRelocatingBundle(bundle)}
                              title="Relocate Bundle"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setQrModalBundle(bundle)}
                              title="View / Print QR Code"
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingBundle(bundle)}
                              title="Edit Bundle"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(bundle)}
                              title="Dissolve Bundle"
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Documents Section */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 dark:bg-slate-800/20">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="ml-8 space-y-2">
                              {/* Expanded header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Documents in this Bundle
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    ({bundleDocs.length} document{bundleDocs.length !== 1 ? 's' : ''})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => selectAllBundleDocs(bundle)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                  >
                                    {allDocsSelected ? 'Deselect All' : 'Select All'}
                                  </button>
                                  {bundle.documentIds.some(id => selectedDocIds.has(id)) && (
                                    <button
                                      onClick={() => setRelocatingBundle(bundle)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                      <Truck className="w-3 h-3" />
                                      Relocate Selected ({bundle.documentIds.filter(id => selectedDocIds.has(id)).length})
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Mobile location display */}
                              {bundle.locationId && (
                                <div className="md:hidden mb-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                                    Location:
                                  </span>
                                  <LocationPathBreadcrumbs locationId={bundle.locationId} badgeSize="sm" />
                                </div>
                              )}

                              {bundleDocs.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">
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
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50'
                                            : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                        onClick={() => toggleDocSelection(doc.id)}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleDocSelection(doc.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 min-w-[80px]">
                                          {doc.documentNumber}
                                        </span>
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">
                                          {doc.title}
                                        </span>
                                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${
                                          doc.status === 'AVAILABLE'
                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : doc.status === 'CHECKED_OUT'
                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {doc.status.replace('_', ' ')}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('documents');
                                            // Note: Could add document selection callback here
                                          }}
                                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
                                          title="View document in catalogue"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Bundle metadata */}
                              <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                                {bundle.imageUrl && (
                                  <img
                                    src={bundle.imageUrl}
                                    alt={bundle.title}
                                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm cursor-zoom-in"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <img
              src={imagePreview.src}
              alt={imagePreview.title}
              className="w-full max-h-64 object-contain bg-slate-50 dark:bg-slate-800"
              referrerPolicy="no-referrer"
            />
            <div className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 truncate">
              {imagePreview.title}
            </div>
          </div>
        </div>
      )}

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
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Bundle</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs">
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{bundle.bundleNumber}</span>
            <span className="text-slate-500 ml-2">{bundle.documentIds.length} document(s)</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Department</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-slate-200"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as DocumentBundle['status'])}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-slate-200"
              >
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
                <option value="SEALED">Sealed</option>
                <option value="CHECKED_OUT">Checked Out</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Storage Location
            </label>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-slate-200"
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

        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
