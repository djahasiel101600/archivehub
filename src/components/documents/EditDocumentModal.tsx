import React, { useState, useEffect, useRef } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { 
  DocumentItem, 
  ConfidentialityLevel, 
  DocumentCondition, 
  DocumentStatus 
} from '../../types';
import { 
  X, 
  Save, 
  Edit3, 
  SlidersHorizontal, 
  Layers, 
  MapPin, 
  FileText, 
  HardDrive, 
  ShieldCheck, 
  Calendar, 
  AlertCircle,
  FolderOpen,
  Upload
} from 'lucide-react';
import { LocationPathBreadcrumbs } from '../common/LocationPathBreadcrumbs';
import { DocumentTypeCombobox } from '../common/DocumentTypeCombobox';

interface EditDocumentModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedDoc: DocumentItem) => void;
}

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  document,
  isOpen,
  onClose,
  onSaved
}) => {
  const { 
    departments, 
    documentTypes, 
    locations, 
    bundles, 
    updateDocument, 
    uploadDigitalCopy,
    calculatePath,
    addNotification
  } = useArchive();

  // Form State
  const [title, setTitle] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [homeLocationId, setHomeLocationId] = useState('');
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>('INTERNAL');
  const [condition, setCondition] = useState<DocumentCondition>('GOOD');
  const [conditionNotes, setConditionNotes] = useState('');
  const [custodianName, setCustodianName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [filedDate, setFiledDate] = useState('');
  const [retentionEndDate, setRetentionEndDate] = useState('');
  const [status, setStatus] = useState<DocumentStatus>('AVAILABLE');
  
  // Custom Classification Fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({});
  
  // Bundle Dossier
  const [bundleId, setBundleId] = useState<string>('');
  
  // Digital copy
  const [hasDigitalCopy, setHasDigitalCopy] = useState(false);
  const [digitalFileName, setDigitalFileName] = useState('');
  const [digitalFileVersion, setDigitalFileVersion] = useState(1);
  const [digitalFileType, setDigitalFileType] = useState('application/pdf');
  const [pendingDigitalFile, setPendingDigitalFile] = useState<File | null>(null);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when document prop changes
  useEffect(() => {
    if (document && isOpen) {
      setTitle(document.title || '');
      setReferenceNumber(document.referenceNumber || '');
      setSubject(document.subject || '');
      setDescription(document.description || '');
      setDepartmentId(document.departmentId || (departments[0]?.id ?? ''));
      setDocumentTypeId(document.documentTypeId || (documentTypes[0]?.id ?? ''));
      setHomeLocationId(document.homeLocationId || (locations[0]?.id ?? ''));
      setConfidentiality(document.confidentiality || 'INTERNAL');
      setCondition(document.condition || 'GOOD');
      setConditionNotes(document.conditionNotes || '');
      setCustodianName(document.custodianName || '');
      setDocumentDate(document.documentDate || '');
      setReceivedDate(document.receivedDate || '');
      setFiledDate(document.filedDate || '');
      setRetentionEndDate(document.retentionEndDate || '');
      setStatus(document.status || 'AVAILABLE');
      setCustomFieldValues(document.customFieldValues || {});
      setBundleId(document.bundleId || '');
      setHasDigitalCopy(Boolean(document.hasDigitalCopy));
      setDigitalFileName(document.digitalFileName || '');
      setDigitalFileVersion(document.digitalFileVersion || 1);
      setDigitalFileType(document.digitalFileType || 'application/pdf');
      setPendingDigitalFile(null);
    }
  }, [document, isOpen, departments, documentTypes, locations]);

  if (!isOpen || !document) return null;

  // Filter available document types for department
  const availableDocTypesForDept = documentTypes.filter(
    dt => !dt.departmentId || dt.departmentId === departmentId
  );

  const handleDeptChange = (newDeptId: string) => {
    setDepartmentId(newDeptId);
    const validTypes = documentTypes.filter(dt => !dt.departmentId || dt.departmentId === newDeptId);
    if (validTypes.length > 0 && !validTypes.some(t => t.id === documentTypeId)) {
      setDocumentTypeId(validTypes[0].id);
      // Reset or initialize custom fields
      const initialCustom: Record<string, string | number> = {};
      validTypes[0].customFields?.forEach(cf => {
        if (cf.defaultValue) initialCustom[cf.name] = cf.defaultValue;
      });
      setCustomFieldValues(initialCustom);
    }
  };

  const handleTypeChange = (newTypeId: string) => {
    setDocumentTypeId(newTypeId);
    const typeInfo = documentTypes.find(dt => dt.id === newTypeId);
    if (typeInfo?.customFields) {
      const mergedValues: Record<string, string | number> = { ...customFieldValues };
      typeInfo.customFields.forEach(cf => {
        if (mergedValues[cf.name] === undefined && cf.defaultValue) {
          mergedValues[cf.name] = cf.defaultValue;
        }
      });
      setCustomFieldValues(mergedValues);
    }
  };

  const selectedDocType = documentTypes.find(dt => dt.id === documentTypeId);
  const selectedDept = departments.find(d => d.id === departmentId);
  const selectedBundle = bundles.find(b => b.id === bundleId);

  const formatPendingFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDigitalFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      addNotification('error', 'File exceeds the 50 MB limit for digitized surrogate copies.');
      return;
    }
    setPendingDigitalFile(file);
    if (!digitalFileName.trim()) setDigitalFileName(file.name);
    if (file.type) setDigitalFileType(file.type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addNotification('error', 'Document title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: Partial<DocumentItem> = {
        title: title.trim(),
        referenceNumber: referenceNumber.trim(),
        subject: subject.trim() || undefined,
        description: description.trim() || undefined,
        departmentId,
        departmentName: selectedDept?.name || document.departmentName,
        documentTypeId,
        documentTypeName: selectedDocType?.name || document.documentTypeName,
        homeLocationId,
        confidentiality,
        condition,
        conditionNotes: conditionNotes.trim() || undefined,
        custodianName: custodianName.trim() || document.custodianName,
        documentDate: documentDate || document.documentDate,
        receivedDate: receivedDate || document.receivedDate,
        filedDate: filedDate || document.filedDate,
        retentionEndDate: retentionEndDate || document.retentionEndDate,
        status,
        customFieldValues,
        bundleId: bundleId || null,
        bundleNumber: selectedBundle ? selectedBundle.bundleNumber : null,
        bundleTitle: selectedBundle ? selectedBundle.title : null,
        hasDigitalCopy,
        digitalFileName: hasDigitalCopy ? (digitalFileName.trim() || `${title.replace(/\s+/g, '_')}.pdf`) : undefined,
        digitalFileVersion: hasDigitalCopy ? digitalFileVersion : undefined,
        digitalFileType: hasDigitalCopy ? digitalFileType : undefined,
        updatedAt: new Date().toISOString()
      };

      await updateDocument(document.id, updates);

      // Upload the selected scan/PDF after metadata is persisted
      if (hasDigitalCopy && pendingDigitalFile) {
        const uploadRes = await uploadDigitalCopy(document.id, pendingDigitalFile, digitalFileVersion);
        if (!uploadRes.success) {
          addNotification('error', `Metadata saved, but the digital copy upload failed: ${uploadRes.message || 'Unknown error'}`);
        } else {
          addNotification('success', `Digitized copy "${pendingDigitalFile.name}" attached to the record.`);
        }
      }
      
      if (onSaved) {
        onSaved({ ...document, ...updates });
      }
      onClose();
    } catch (err: any) {
      addNotification('error', `Failed to update document: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Edit Document Metadata
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  #{document.documentNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update classification, physical archive placement, and digital attachments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
            
            {/* Primary Document Identifiers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Number (System ID)
                </label>
                <input
                  type="text"
                  disabled
                  value={document.documentNumber}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference Number / Tracking Code
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. REF-ENG-2026-001"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Document Title */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Document Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Official title or label on the physical folder/binder..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Department and Document Type Classification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Owning Department *
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-semibold text-slate-800 dark:text-slate-200"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Document Type *</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
                    (Retention: {selectedDocType?.retentionYears || 5} Yrs)
                  </span>
                </label>
                <DocumentTypeCombobox
                  options={availableDocTypesForDept}
                  value={documentTypeId}
                  onChange={handleTypeChange}
                  emptyMessage="No types tied to this department"
                />
              </div>
            </div>

            {/* Dynamic Custom Classification Fields */}
            {selectedDocType?.customFields && selectedDocType.customFields.length > 0 && (
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Classification Fields for {selectedDocType.name}
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
                          value={String(customFieldValues[field.name] ?? '')}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
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
                          value={String(customFieldValues[field.name] ?? '')}
                          placeholder={field.placeholder || `Enter ${field.label}...`}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl outline-none font-medium"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Disambiguation Identifier Live Preview */}
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800/80 text-[11px] text-slate-800 dark:text-slate-200 space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    Disambiguated Classification Preview:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap font-semibold">
                    <span className="text-indigo-900 dark:text-indigo-200">{title || '[Document Title]'}</span>
                    {Object.entries(customFieldValues).filter(([_, val]) => Boolean(val)).map(([key, val]) => (
                      <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 text-[10px]">
                        <span className="text-slate-500 font-normal">{key}:</span> {val}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Permanent Home Storage Location Assignment */}
            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Permanent Home Archive Storage Location *
                </label>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Vault Origin</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                The designated vault cabinet, rack, shelf, or folder where this document physically belongs.
              </p>
              <select
                required
                value={homeLocationId}
                onChange={(e) => setHomeLocationId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl outline-none font-medium"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                  </option>
                ))}
              </select>
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 block mb-0.5">Selected Path:</span>
                <LocationPathBreadcrumbs locationId={homeLocationId} badgeSize="sm" />
              </div>
            </div>

            {/* Bundle Dossier Assignment */}
            <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Dossier / Bundle Association
                </label>
                <span className="text-[10px] text-amber-700 dark:text-amber-300">Optional</span>
              </div>
              <select
                value={bundleId}
                onChange={(e) => setBundleId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 rounded-xl outline-none font-medium"
              >
                <option value="">-- Standalone Document (Not in a Bundle) --</option>
                {bundles.map(b => (
                  <option key={b.id} value={b.id}>
                    [{b.bundleNumber}] {b.title} ({b.documentIds.length} items)
                  </option>
                ))}
              </select>
            </div>

            {/* Confidentiality, Condition & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confidentiality Level
                </label>
                <select
                  value={confidentiality}
                  onChange={(e) => setConfidentiality(e.target.value as ConfidentialityLevel)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
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
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as DocumentCondition)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                >
                  <option value="EXCELLENT">Excellent (Crisp/New)</option>
                  <option value="GOOD">Good (Intact)</option>
                  <option value="FAIR">Fair (Slight wear)</option>
                  <option value="DAMAGED">Damaged (Fragile/Torn)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                >
                  <option value="AVAILABLE">Available in Archive</option>
                  <option value="CHECKED_OUT">Checked Out / Borrowed</option>
                  <option value="IN_TRANSIT">In Transit / Movement</option>
                  <option value="REGISTERED">Registered (Pending Filing)</option>
                  <option value="ARCHIVED">Archived / Cold Storage</option>
                  <option value="DAMAGED">Damaged / In Repair</option>
                  <option value="MISSING">Missing / Investigation</option>
                </select>
              </div>
            </div>

            {/* Condition Notes (if damaged or fair) */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Condition Notes & Preservation Instructions
              </label>
              <input
                type="text"
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                placeholder="e.g. Minor edge fading on page 3, stored in acid-free preservation sleeve"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
              />
            </div>

            {/* Dates & Custodian */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Date
                </label>
                <input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Received / Filed Date
                </label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Custodian / Officer
                </label>
                <input
                  type="text"
                  value={custodianName}
                  onChange={(e) => setCustodianName(e.target.value)}
                  placeholder="Responsible custodian..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* Subject and Description */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject Summary / Abstract
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Executive summary of document scope, stipulations, and keywords..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none resize-none focus:border-indigo-500"
              />
            </div>

            {/* Digital Surrogate Copy Attachment */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-xs text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={hasDigitalCopy}
                  onChange={(e) => setHasDigitalCopy(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Attach Digitized Electronic Surrogate Copy (PDF / Scan)
                </span>
              </label>

              {hasDigitalCopy && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
                  {/* Scan / PDF File Upload */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Scan / PDF File {document.hasDigitalCopy && '(replaces the current attachment)'}
                    </label>
                    <input
                      ref={digitalFileInputRef}
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp,image/tiff,.tif"
                      className="hidden"
                      onChange={handleDigitalFileSelected}
                    />
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => digitalFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] rounded-xl shadow-xs transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {pendingDigitalFile ? 'Change File' : document.hasDigitalCopy ? 'Replace File' : 'Choose File'}
                      </button>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {pendingDigitalFile
                          ? `${pendingDigitalFile.name} (${formatPendingFileSize(pendingDigitalFile.size)})`
                          : document.hasDigitalCopy && document.digitalFileName
                            ? `Current: ${document.digitalFileName}`
                            : 'No file selected yet.'}
                      </span>
                    </div>
                    {pendingDigitalFile && (
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
                        The file will be uploaded to server storage when you save.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Digitized File Name
                      </label>
                      <input
                        type="text"
                        value={digitalFileName}
                        onChange={(e) => setDigitalFileName(e.target.value)}
                        placeholder="e.g. Contract_2026_Final_Scan.pdf"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Version Number
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={digitalFileVersion}
                        onChange={(e) => setDigitalFileVersion(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="text-[11px] text-slate-400">
              * Changes are audited and timestamped in the system log.
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Saving Changes...' : 'Save Updates'}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
