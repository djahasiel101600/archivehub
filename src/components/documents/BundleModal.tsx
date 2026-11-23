import React, { useState, useEffect } from 'react';
import { DocumentItem, DocumentBundle } from '../../types';
import { useArchive } from '../../context/ArchiveContext';
import { suggestBundleFromDocuments } from '../../ai/suggestBundle';
import { PhotoUploader } from '../common/PhotoUploader';
import { 
  Layers, 
  X, 
  Plus, 
  FolderPlus,
  Loader2
} from 'lucide-react';

interface BundleModalProps {
  selectedDocuments: DocumentItem[];
  onClose: () => void;
  onSuccess?: () => void;
  /** Create an empty dossier (no pre-selected documents) to be filled later via QR scanning */
  emptyMode?: boolean;
  /** Called with the freshly created bundle — used to chain into scan-to-fill */
  onCreated?: (bundle: DocumentBundle) => void;
}

export const BundleModal: React.FC<BundleModalProps> = ({
  selectedDocuments,
  onClose,
  onSuccess,
  emptyMode = false,
  onCreated
}) => {
  const { 
    bundles, 
    departments, 
    locations, 
    addBundle, 
    addDocumentsToBundle, 
    calculatePath,
    addNotification 
  } = useArchive();

  const [mode, setMode] = useState<'create' | 'existing'>('create');
  
  // Existing Bundle Selection
  const [selectedExistingBundleId, setSelectedExistingBundleId] = useState<string>(bundles[0]?.id || '');

  // New Bundle Form State
  const defaultDeptId = selectedDocuments[0]?.departmentId || departments[0]?.id || '';
  const defaultDeptObj = departments.find(d => d.id === defaultDeptId);
  const defaultLocationId = selectedDocuments[0]?.homeLocationId || locations[0]?.id || '';

  const [bundleTitle, setBundleTitle] = useState(
    selectedDocuments.length > 0 
      ? `Case Dossier: ${selectedDocuments[0].title.slice(0, 40)} Group`
      : ''
  );
  const [bundleNumber, setBundleNumber] = useState(
    `BNDL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [departmentId, setDepartmentId] = useState(defaultDeptId);
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [description, setDescription] = useState(
    selectedDocuments.length > 0
      ? `Consolidated archive bundle containing ${selectedDocuments.length} document(s).`
      : 'Empty archive dossier — fill it by scanning document QR codes.'
  );
  const [tagsInput, setTagsInput] = useState('Dossier, Case File');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Fetch AI-powered suggestions when modal opens in create mode
  useEffect(() => {
    if (mode !== 'create' || selectedDocuments.length === 0) return;
    let cancelled = false;
    setIsSuggesting(true);
    suggestBundleFromDocuments(selectedDocuments)
      .then((suggestion) => {
        if (cancelled) return;
        if (suggestion.title) setBundleTitle(suggestion.title);
        if (suggestion.description) setDescription(suggestion.description);
        if (suggestion.tags && suggestion.tags.length > 0) setTagsInput(suggestion.tags.join(', '));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsSuggesting(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleTitle.trim() || !bundleNumber.trim()) return;

    setIsSubmitting(true);
    try {
      const deptObj = departments.find(d => d.id === departmentId);
      const locPath = calculatePath(locationId);
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const docIds = selectedDocuments.map(d => d.id);

      await addBundle({
        bundleNumber: bundleNumber.trim().toUpperCase(),
        title: bundleTitle.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
        departmentId,
        departmentName: deptObj?.name || 'General Department',
        locationId,
        locationPath: locPath,
        documentIds: docIds,
        status: 'ACTIVE',
        tags
      }).then((created) => {
        if (onCreated) onCreated(created);
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToExistingBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExistingBundleId) return;

    setIsSubmitting(true);
    try {
      const docIds = selectedDocuments.map(d => d.id);
      await addDocumentsToBundle(selectedExistingBundleId, docIds);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="card max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="section-title">
                {emptyMode ? 'Create Empty Bundle / Dossier' : 'Bundle & Group Selected Documents'}
              </h3>
              <p className="meta">
                {emptyMode
                  ? 'Create an empty dossier, then fill it by scanning document QR codes'
                  : `Organize ${selectedDocuments.length} physical record(s) into a unified dossier/folder`}
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

        {/* Mode Selector Tabs (hidden in empty-bundle mode — create only) */}
        {!emptyMode && (
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-800/40 p-2 gap-2 text-xs font-semibold flex-shrink-0">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === 'create'
                ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-sm border border-zinc-200/80 dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Bundle / Dossier
          </button>

          <button
            type="button"
            onClick={() => setMode('existing')}
            disabled={bundles.length === 0}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 ${
              mode === 'existing'
                ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-sm border border-zinc-200/80 dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Add to Existing Bundle ({bundles.length})
          </button>
        </div>
        )}

        {/* Selected Documents Ribbon (hidden in empty-bundle mode) */}
        {!emptyMode && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 px-5 py-2.5 border-b border-amber-200/60 dark:border-amber-900/40 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
              {selectedDocuments.length} Record(s) Selected:
            </span>
            <div className="flex gap-1.5 flex-wrap max-w-md truncate">
              {selectedDocuments.slice(0, 3).map(d => (
                <span key={d.id} className="font-mono text-[10px] bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-semibold text-zinc-700 dark:text-zinc-300">
                  {d.documentNumber}
                </span>
              ))}
              {selectedDocuments.length > 3 && (
                <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">
                  +{selectedDocuments.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Form Body */}
        {(emptyMode || mode === 'create') ? (
          <form onSubmit={handleCreateBundle} className="flex-1 flex flex-col min-h-0">
            <div className="p-6 space-y-3.5 overflow-y-auto flex-1 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">
                    Bundle / Dossier Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={bundleNumber}
                    onChange={(e) => setBundleNumber(e.target.value)}
                    placeholder="e.g. BNDL-2026-001"
                    className="input font-mono font-bold text-amber-700 dark:text-amber-400"
                  />
                </div>

                <div>
                  <label className="label">
                    Owning Department *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="input font-semibold"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="label">
                    Bundle Title / Dossier Subject *
                  </label>
                  {isSuggesting && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      AI suggesting...
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={bundleTitle}
                  onChange={(e) => setBundleTitle(e.target.value)}
                  placeholder="e.g. 2026 Jalaur River Project Bid & Contract Dossier"
                  className="input font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Designated Archive Location *
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="input font-mono text-[11px]"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Scope & Contents Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of bundle contents and purpose..."
                  className="input resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. Bid Package, Legal, Multi-part"
                  className="input"
                />
              </div>

              <PhotoUploader
                value={imageUrl}
                onChange={setImageUrl}
                label="Bundle / Dossier Photo (Optional)"
              />

            </div>

            {/* Form Actions */}
            <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Creating Bundle...' : emptyMode ? 'Create Empty Bundle' : `Create Bundle & Group ${selectedDocuments.length} Item(s)`}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddToExistingBundle} className="flex-1 flex flex-col min-h-0">
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="label mb-2">
                  Select Existing Target Bundle Dossier *
                </label>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {bundles.map(b => (
                    <label
                      key={b.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedExistingBundleId === b.id
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="existingBundle"
                        value={b.id}
                        checked={selectedExistingBundleId === b.id}
                        onChange={(e) => setSelectedExistingBundleId(e.target.value)}
                        className="mt-0.5 text-teal-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                            {b.bundleNumber}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {b.documentIds.length} existing items
                          </span>
                        </div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                          {b.title}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                          Dept: {b.departmentName} | Loc: {b.locationPath}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedExistingBundleId}
                className="btn btn-primary"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Adding...' : `Add ${selectedDocuments.length} Item(s) to Bundle`}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
