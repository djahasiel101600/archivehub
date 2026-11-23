import React, { useState } from 'react';
import { ShieldCheck, Building2, X, Loader2, Layers } from 'lucide-react';
import { useArchive } from '../../context/ArchiveContext';
import { ConfidentialityLevel, DocumentCondition } from '../../types';

interface BulkUpdateModalProps {
  isOpen: boolean;
  /** 'security' = Confidentiality & Condition, 'department' = owning Department */
  mode: 'security' | 'department';
  documentIds: string[];
  onClose: () => void;
}

const CONFIDENTIALITY_OPTIONS: ConfidentialityLevel[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
const CONDITION_OPTIONS: DocumentCondition[] = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'MISSING'];

const pretty = (value: string) => value.split('_').join(' ');

/**
 * Applies one metadata change to every selected catalogue record at once:
 * either Security classification + Physical condition, or owning Department.
 * Fields left on "Keep current value" are not sent, so a single attribute can
 * be updated without touching the other.
 */
export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ isOpen, mode, documentIds, onClose }) => {
  const { departments, bulkUpdateDocuments } = useArchive();

  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel | ''>('');
  const [condition, setCondition] = useState<DocumentCondition | ''>('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const isSecurity = mode === 'security';
  const canSubmit = isSecurity
    ? (confidentiality !== '' || condition !== '')
    : !!departmentId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSaving || documentIds.length === 0) return;
    setIsSaving(true);
    try {
      const updates: { confidentiality?: ConfidentialityLevel; condition?: DocumentCondition; departmentId?: string; departmentName?: string } = {};
      if (isSecurity) {
        if (confidentiality) updates.confidentiality = confidentiality;
        if (condition) updates.condition = condition;
      } else {
        const dept = departments.find(d => d.id === departmentId);
        if (dept) {
          updates.departmentId = dept.id;
          updates.departmentName = dept.name;
        }
      }
      await bulkUpdateDocuments(documentIds, updates);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="card max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">
        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 flex-shrink-0">
          <h3 className="section-title flex items-center gap-2">
            {isSecurity ? <ShieldCheck className="w-4 h-4 text-teal-600" aria-hidden="true" /> : <Building2 className="w-4 h-4 text-teal-600" aria-hidden="true" />}
            {isSecurity ? 'Bulk Update Security & Condition' : 'Bulk Change Department'}
          </h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-6 space-y-3.5 overflow-y-auto flex-1 text-xs">
            <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-xl">
              <Layers className="w-4 h-4 text-teal-600 flex-shrink-0" />
              <span className="font-semibold text-teal-800 dark:text-teal-300">
                {documentIds.length} record(s) selected — the change below applies to all of them.
              </span>
            </div>

            {isSecurity ? (
              <>
                <div>
                  <label className="label">
                    Security Classification
                  </label>
                  <select
                    value={confidentiality}
                    onChange={(e) => setConfidentiality(e.target.value as ConfidentialityLevel | '')}
                    className="input font-medium"
                  >
                    <option value="">Keep current value</option>
                    {CONFIDENTIALITY_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{pretty(opt)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">
                    Physical Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as DocumentCondition | '')}
                    className="input font-medium"
                  >
                    <option value="">Keep current value</option>
                    {CONDITION_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{pretty(opt)}</option>
                    ))}
                  </select>
                </div>

                <p className="field-hint">
                  Pick at least one attribute. Anything left on "Keep current value" stays untouched.
                </p>
              </>
            ) : (
              <div>
                <label className="label">
                  New Owning Department *
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="input font-medium"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>[{dept.code}] {dept.name}</option>
                  ))}
                </select>
                <p className="field-hint mt-1">
                  Reassigns ownership of every selected record to this department.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSaving}
              className="btn btn-primary"
            >
              {isSaving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying...</>
              ) : (
                <span>Apply to {documentIds.length} Record(s)</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
