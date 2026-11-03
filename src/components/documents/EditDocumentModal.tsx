import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileText, Loader2, Save, Upload, X } from 'lucide-react';
import { useArchive } from '../../context/ArchiveContext';
import { ConfidentialityLevel, DocumentCondition, DocumentItem } from '../../types';
import { DocumentTypeCombobox } from '../common/DocumentTypeCombobox';
import { LocationPathBreadcrumbs } from '../common/LocationPathBreadcrumbs';
import { DocumentPhotosEditor } from './DocumentPhotosEditor';

interface EditDocumentModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedDoc: DocumentItem) => void;
}

const CONFIDENTIALITY_OPTIONS: ConfidentialityLevel[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
const CONDITION_OPTIONS: DocumentCondition[] = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'MISSING'];
export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  document,
  isOpen,
  onClose,
  onSaved,
}) => {
  const {
    currentUser,
    departments,
    documentTypes,
    locations,
    updateDocument,
    uploadDigitalCopy,
    calculatePath,
  } = useArchive();

  const [title, setTitle] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [homeLocationId, setHomeLocationId] = useState('');
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>('INTERNAL');
  const [condition, setCondition] = useState<DocumentCondition>('GOOD');
  const [draftStatus, setDraftStatus] = useState<'DRAFT' | 'AVAILABLE'>('DRAFT');
  const [conditionNotes, setConditionNotes] = useState('');
  const [custodianName, setCustodianName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [filedDate, setFiledDate] = useState('');
  const [retentionEndDate, setRetentionEndDate] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({});
  const [photos, setPhotos] = useState<DocumentItem['photos']>([]);
  const [pendingDigitalFile, setPendingDigitalFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const digitalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!document || !isOpen) return;
    setTitle(document.title || '');
    setReferenceNumber(document.referenceNumber || '');
    setSubject(document.subject || '');
    setDescription(document.description || '');
    setDepartmentId(document.departmentId || departments[0]?.id || '');
    setDocumentTypeId(document.documentTypeId || documentTypes[0]?.id || '');
    setHomeLocationId(document.homeLocationId || locations[0]?.id || '');
    setConfidentiality(document.confidentiality || 'INTERNAL');
    setCondition(document.condition || 'GOOD');
    setDraftStatus(document.status === 'DRAFT' ? 'DRAFT' : 'AVAILABLE');
    setConditionNotes(document.conditionNotes || '');
    setCustodianName(document.custodianName || '');
    setDocumentDate(document.documentDate?.slice(0, 10) || '');
    setReceivedDate(document.receivedDate?.slice(0, 10) || '');
    setFiledDate(document.filedDate?.slice(0, 10) || '');
    setRetentionEndDate(document.retentionEndDate?.slice(0, 10) || '');
    setCustomFieldValues(document.customFieldValues || {});
    setPhotos(document.photos || []);
    setPendingDigitalFile(null);
    setSubmitError('');
  }, [document, isOpen, departments, documentTypes, locations]);

  if (!isOpen || !document) return null;

  const availableTypes = documentTypes.filter(
    type => !type.departmentId || type.departmentId === 'ALL' || type.departmentId === departmentId
  );
  const selectedType = documentTypes.find(type => type.id === documentTypeId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const department = departments.find(item => item.id === departmentId);
      const updatedDoc: DocumentItem = {
        ...document,
        title: title.trim(),
        referenceNumber: referenceNumber.trim(),
        subject: subject.trim(),
        description: description.trim(),
        departmentId,
        departmentName: department?.name || document.departmentName,
        documentTypeId,
        documentTypeName: selectedType?.name || document.documentTypeName,
        homeLocationId,
        confidentiality,
        condition,
        status: document.status === 'DRAFT' ? draftStatus : document.status,
        conditionNotes: conditionNotes.trim(),
        custodianName: custodianName.trim(),
        documentDate,
        receivedDate,
        filedDate,
        retentionEndDate,
        customFieldValues,
        photos,
      };

      await updateDocument(document.id, {
        title: updatedDoc.title,
        referenceNumber: updatedDoc.referenceNumber,
        subject: updatedDoc.subject,
        description: updatedDoc.description,
        departmentId: updatedDoc.departmentId,
        departmentName: updatedDoc.departmentName,
        documentTypeId: updatedDoc.documentTypeId,
        documentTypeName: updatedDoc.documentTypeName,
        homeLocationId: updatedDoc.homeLocationId,
        confidentiality: updatedDoc.confidentiality,
        condition: updatedDoc.condition,
        ...(document.status === 'DRAFT' ? { status: updatedDoc.status } : {}),
        conditionNotes: updatedDoc.conditionNotes,
        custodianName: updatedDoc.custodianName,
        documentDate: updatedDoc.documentDate,
        receivedDate: updatedDoc.receivedDate,
        filedDate: updatedDoc.filedDate,
        retentionEndDate: updatedDoc.retentionEndDate,
        customFieldValues: updatedDoc.customFieldValues,
        photos: updatedDoc.photos,
      });

      if (pendingDigitalFile) {
        const upload = await uploadDigitalCopy(
          document.id,
          pendingDigitalFile,
          (document.digitalFileVersion || 0) + 1
        );
        if (!upload.success) throw new Error(upload.message || 'Digital copy upload failed.');
      }

      onSaved?.(updatedDoc);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document update failed.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
  const labelClass = 'mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
      <div className="my-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Edit document</h2>
              <p className="truncate text-xs text-slate-500">{document.documentNumber}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close edit document" className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            {submitError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="edit-document-title">
                  Title {document.status === 'DRAFT' && draftStatus === 'DRAFT' ? <span className="font-normal text-slate-400">(optional while draft)</span> : '*'}
                </label>
                <input id="edit-document-title" required={document.status !== 'DRAFT' || draftStatus !== 'DRAFT'} maxLength={500} value={title} onChange={event => setTitle(event.target.value)} className={inputClass} />
              </div>
              {document.status === 'DRAFT' && (
                <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                  <label className={labelClass} htmlFor="edit-draft-status">Draft workflow</label>
                  <select id="edit-draft-status" value={draftStatus} onChange={event => setDraftStatus(event.target.value as 'DRAFT' | 'AVAILABLE')} className={inputClass}>
                    <option value="DRAFT">Keep as draft — details can be completed later</option>
                    <option value="AVAILABLE">Complete record and make it available</option>
                  </select>
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="edit-document-reference">Reference number</label>
                <input id="edit-document-reference" maxLength={100} value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-document-custodian">Custodian</label>
                <input id="edit-document-custodian" maxLength={255} value={custodianName} onChange={event => setCustodianName(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-document-department">Department *</label>
                <select id="edit-document-department" required value={departmentId} onChange={event => {
                  const nextDepartmentId = event.target.value;
                  setDepartmentId(nextDepartmentId);
                  const typesForDepartment = documentTypes.filter(type => !type.departmentId || type.departmentId === 'ALL' || type.departmentId === nextDepartmentId);
                  if (!typesForDepartment.some(type => type.id === documentTypeId)) setDocumentTypeId(typesForDepartment[0]?.id || '');
                }} className={inputClass}>
                  {departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Document type *</label>
                <DocumentTypeCombobox options={availableTypes} value={documentTypeId} onChange={setDocumentTypeId} emptyMessage="No document types available for this department." />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="edit-document-subject">Subject</label>
                <input id="edit-document-subject" value={subject} onChange={event => setSubject(event.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="edit-document-description">Description</label>
                <textarea id="edit-document-description" rows={3} value={description} onChange={event => setDescription(event.target.value)} className={inputClass} />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="edit-document-home-location">Home storage location *</label>
                <select id="edit-document-home-location" required value={homeLocationId} onChange={event => setHomeLocationId(event.target.value)} className={inputClass}>
                  {locations.map(location => <option key={location.id} value={location.id}>{location.name} ({calculatePath(location.id)})</option>)}
                </select>
                <LocationPathBreadcrumbs locationId={homeLocationId} className="mt-2" badgeSize="sm" />
              </div>

              <div>
                <label className={labelClass} htmlFor="edit-document-confidentiality">Confidentiality</label>
                <select id="edit-document-confidentiality" value={confidentiality} onChange={event => setConfidentiality(event.target.value as ConfidentialityLevel)} className={inputClass}>
                  {CONFIDENTIALITY_OPTIONS.map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-document-condition">Physical condition</label>
                <select id="edit-document-condition" value={condition} onChange={event => setCondition(event.target.value as DocumentCondition)} className={inputClass}>
                  {CONDITION_OPTIONS.map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-document-condition-notes">Condition notes</label>
                <input id="edit-document-condition-notes" value={conditionNotes} onChange={event => setConditionNotes(event.target.value)} className={inputClass} />
              </div>

              <div>
                <label className={labelClass} htmlFor="edit-document-date">Document date *</label>
                <input id="edit-document-date" required type="date" value={documentDate} onChange={event => setDocumentDate(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-document-received">Received date</label>
                <input id="edit-document-received" type="date" value={receivedDate} onChange={event => setReceivedDate(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-document-filed">Filed date</label>
                <input id="edit-document-filed" type="date" value={filedDate} onChange={event => setFiledDate(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-document-retention">Retention end date</label>
                <input id="edit-document-retention" type="date" value={retentionEndDate} onChange={event => setRetentionEndDate(event.target.value)} className={inputClass} />
              </div>

              {selectedType?.customFields?.map(field => (
                <div key={field.id}>
                  <label className={labelClass} htmlFor={`edit-custom-${field.id}`}>{field.label}{field.required && ' *'}</label>
                  {field.type === 'select' ? (
                    <select id={`edit-custom-${field.id}`} required={field.required} value={String(customFieldValues[field.name] ?? '')} onChange={event => setCustomFieldValues(previous => ({ ...previous, [field.name]: event.target.value }))} className={inputClass}>
                      <option value="">Select {field.label}</option>
                      {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input id={`edit-custom-${field.id}`} required={field.required} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} placeholder={field.placeholder} value={String(customFieldValues[field.name] ?? '')} onChange={event => setCustomFieldValues(previous => ({ ...previous, [field.name]: field.type === 'number' && event.target.value ? Number(event.target.value) : event.target.value }))} className={inputClass} />
                  )}
                </div>
              ))}

              <div className="sm:col-span-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <DocumentPhotosEditor photos={photos} onChange={setPhotos} user={currentUser} />
              </div>

              <div className="sm:col-span-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <label className={labelClass}>Digital copy</label>
                {document.hasDigitalCopy && (
                  <p className="mb-2 text-xs text-slate-500">Current file: {document.digitalFileName || 'Attached'}{document.digitalFileVersion ? ` (version ${document.digitalFileVersion})` : ''}</p>
                )}
                <input ref={digitalFileInputRef} type="file" onChange={event => setPendingDigitalFile(event.target.files?.[0] || null)} className="sr-only" />
                <button type="button" onClick={() => digitalFileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Upload className="h-4 w-4" /> {pendingDigitalFile ? pendingDigitalFile.name : document.hasDigitalCopy ? 'Replace digital copy' : 'Attach digital copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/50 sm:px-6">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !documentTypeId || !homeLocationId} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSubmitting ? 'Saving...' : document.status === 'DRAFT' && draftStatus === 'DRAFT' ? 'Save draft' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
