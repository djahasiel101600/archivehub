import React, { useEffect, useState } from 'react';
import { ArrowLeft, Camera, FilePlus2, Loader2, Save } from 'lucide-react';
import { useArchive } from '../context/ArchiveContext';
import { DocumentCondition, DocumentItem, DocumentPhoto, NewDocumentItem } from '../types';
import { DocumentPhotosEditor } from '../components/documents/DocumentPhotosEditor';

const PRESET_STORAGE_KEY = 'archivehub_document_capture_presets';

interface CapturePresets {
  departmentId: string;
  documentTypeId: string;
  homeLocationId: string;
}

function getRememberedPresets(): CapturePresets {
  try {
    const saved = localStorage.getItem(PRESET_STORAGE_KEY);
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
  } catch (error) {
    console.warn('Could not read remembered document capture presets:', error);
  }
  return { departmentId: '', documentTypeId: '', homeLocationId: '' };
}

interface DocumentCapturePageProps {
  onCancel: () => void;
  onSaved: (document: DocumentItem) => void;
}

export const DocumentCapturePage: React.FC<DocumentCapturePageProps> = ({ onCancel, onSaved }) => {
  const {
    currentUser,
    departments,
    documentTypes,
    locations,
    addDocument,
    calculatePath,
  } = useArchive();

  const [remembered] = useState(getRememberedPresets);
  const [departmentId, setDepartmentId] = useState(remembered.departmentId);
  const [documentTypeId, setDocumentTypeId] = useState(remembered.documentTypeId);
  const [homeLocationId, setHomeLocationId] = useState(remembered.homeLocationId);
  const [title, setTitle] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState<DocumentCondition>('GOOD');
  const [photos, setPhotos] = useState<DocumentPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const availableTypes = documentTypes.filter(
    type => !type.departmentId || type.departmentId === 'ALL' || type.departmentId === departmentId
  );
  const selectedType = documentTypes.find(type => type.id === documentTypeId);
  const selectedDepartment = departments.find(department => department.id === departmentId);
  const typeMatchesDepartment = Boolean(
    selectedType && (!selectedType.departmentId || selectedType.departmentId === 'ALL' || selectedType.departmentId === departmentId)
  );
  const presetsReady = Boolean(typeMatchesDepartment && selectedDepartment && locations.some(location => location.id === homeLocationId));

  useEffect(() => {
    if (departments.length && remembered.departmentId && !departments.some(item => item.id === remembered.departmentId)) setDepartmentId('');
    if (documentTypes.length && remembered.documentTypeId && !documentTypes.some(item => item.id === remembered.documentTypeId)) setDocumentTypeId('');
    if (locations.length && remembered.homeLocationId && !locations.some(item => item.id === remembered.homeLocationId)) setHomeLocationId('');
  }, [remembered, departments, documentTypes, locations]);

  useEffect(() => {
    if (!typeMatchesDepartment || !selectedDepartment || !locations.some(location => location.id === homeLocationId)) return;
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify({ departmentId, documentTypeId, homeLocationId }));
    } catch (error) {
      console.warn('Could not remember document capture presets:', error);
    }
  }, [departmentId, documentTypeId, homeLocationId, typeMatchesDepartment, selectedDepartment, locations]);

  const handleDepartmentChange = (nextDepartmentId: string) => {
    setDepartmentId(nextDepartmentId);
    if (!documentTypes.some(type => type.id === documentTypeId && (!type.departmentId || type.departmentId === 'ALL' || type.departmentId === nextDepartmentId))) {
      setDocumentTypeId('');
    }
  };

  const handleTypeChange = (nextTypeId: string) => {
    setDocumentTypeId(nextTypeId);
    const nextType = documentTypes.find(type => type.id === nextTypeId);
    if (nextType?.departmentId && nextType.departmentId !== 'ALL') setDepartmentId(nextType.departmentId);
  };

  const handleSaveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!presetsReady || photos.length === 0 || isSaving) return;
    setIsSaving(true);

    const today = new Date().toISOString().slice(0, 10);
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + (selectedType?.retentionYears || 10));
    const draft: NewDocumentItem = {
      documentNumber: '',
      referenceNumber: referenceNumber.trim(),
      title: title.trim(),
      documentTypeId,
      documentTypeName: selectedType?.name || 'General Record',
      subject: subject.trim(),
      description: description.trim(),
      departmentId,
      departmentName: selectedDepartment?.name || 'General Department',
      custodianName: 'Records Office',
      homeLocationId,
      confidentiality: 'INTERNAL',
      condition,
      documentDate: documentDate || today,
      receivedDate: today,
      filedDate: today,
      retentionStartDate: today,
      retentionEndDate: retentionDate.toISOString().slice(0, 10),
      hasDigitalCopy: false,
      customFieldValues: {},
      photos,
      status: 'DRAFT',
    };

    try {
      const saved = await addDocument(draft);
      onSaved(saved);
    } catch {
      // The context reports the failure and leaves this draft form intact.
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Photo-first document intake</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Capture the cover now; complete the record now or later.</p>
          </div>
        </div>
        <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to documents
        </button>
      </header>

      <form onSubmit={handleSaveDraft} className="space-y-5">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
          <div>
            <label htmlFor="capture-department" className={labelClass}>Owning department</label>
            <select id="capture-department" required value={departmentId} onChange={event => handleDepartmentChange(event.target.value)} className={inputClass}>
              <option value="">Select department</option>
              {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="capture-document-type" className={labelClass}>Document type</label>
            <select id="capture-document-type" required value={documentTypeId} onChange={event => handleTypeChange(event.target.value)} className={inputClass}>
              <option value="">Select document type</option>
              {availableTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="capture-home-location" className={labelClass}>Home storage location</label>
            <select id="capture-home-location" required value={homeLocationId} onChange={event => setHomeLocationId(event.target.value)} className={inputClass}>
              <option value="">Select home location</option>
              {locations.map(location => <option key={location.id} value={location.id}>{location.name} — {calculatePath(location.id)}</option>)}
            </select>
          </div>
          {!presetsReady && (
            <p className="text-xs text-amber-700 dark:text-amber-300 md:col-span-3">Confirm the department, document type, and home location before adding photos.</p>
          )}
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <DocumentPhotosEditor photos={photos} onChange={setPhotos} user={currentUser} disabled={!presetsReady} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Record details</h2>
                <p className="mt-1 text-xs text-slate-500">A title is optional for a draft. You can finish it later.</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Draft intake</span>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="capture-title" className={labelClass}>Title <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="capture-title" maxLength={500} value={title} onChange={event => setTitle(event.target.value)} placeholder="Add a title now or later" className={inputClass} />
              </div>
              <div>
                <label htmlFor="capture-reference" className={labelClass}>Reference number <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="capture-reference" maxLength={100} value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="capture-subject" className={labelClass}>Subject / summary</label>
                <input id="capture-subject" value={subject} onChange={event => setSubject(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="capture-description" className={labelClass}>Description</label>
                <textarea id="capture-description" rows={3} value={description} onChange={event => setDescription(event.target.value)} className={inputClass} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="capture-document-date" className={labelClass}>Document date</label>
                  <input id="capture-document-date" type="date" value={documentDate} onChange={event => setDocumentDate(event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="capture-condition" className={labelClass}>Physical condition</label>
                  <select id="capture-condition" value={condition} onChange={event => setCondition(event.target.value as DocumentCondition)} className={inputClass}>
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="MISSING">Missing</option>
                  </select>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500">Images are resized before saving. Maximum five photos; the first photo is the cover.</p>
          <button type="submit" disabled={!presetsReady || photos.length === 0 || isSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Saving draft...' : <><FilePlus2 className="h-4 w-4" /> Save photo intake as draft</>}
          </button>
        </footer>
      </form>
    </div>
  );
};
