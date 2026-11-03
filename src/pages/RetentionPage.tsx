import React, { useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  FileCheck, 
  Trash2, 
  CheckCircle2,
  Calendar,
  Building2
} from 'lucide-react';

export const RetentionPage: React.FC = () => {
  const { documents, documentTypes } = useArchive();
  const [scheduledReviewMsg, setScheduledReviewMsg] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewDeadline = new Date(today);
  reviewDeadline.setFullYear(today.getFullYear() + 5);

  const expiringSoonDocs = documents.filter(doc => {
    if (!doc.retentionEndDate) return false;
    const expiryDate = new Date(`${doc.retentionEndDate}T00:00:00`);
    const expiry = expiryDate.getTime();
    return !Number.isNaN(expiry) && expiry > today.getTime() && expiry <= reviewDeadline.getTime();
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      <PageHeader
        icon={ShieldCheck}
        title="Retention management"
        description="Review retention schedules and upcoming document expiry dates."
      />

      {scheduledReviewMsg && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-indigo-800 dark:text-indigo-200 flex items-center justify-between">
          <span>{scheduledReviewMsg}</span>
          <button
            type="button"
            onClick={() => setScheduledReviewMsg(null)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Retention Policies Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
          Active Statutory Retention Schedules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {documentTypes.map(dt => (
            <div key={dt.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{dt.name}</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 rounded">
                  {dt.retentionYears} Years
                </span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">{dt.description || `${dt.name} statutory archiving schedule.`}</p>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-400">
                Disposal Method: {dt.retentionYears >= 50 ? 'Permanent National Archive' : 'Controlled High-Security Destruction'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Retention Expiring Countdown Records */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
            Records Scheduled for Retention Review
          </h3>
          <span className="text-xs text-slate-400">Automated Expiry Calculator</span>
        </div>

        <div className="space-y-3">
          {expiringSoonDocs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No records are scheduled for retention review in the next five years.
            </p>
          ) : expiringSoonDocs.map(doc => (
            <div key={doc.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">#{doc.documentNumber}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{doc.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Type: {doc.documentTypeName} • Department: {doc.departmentName}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <div className="text-left sm:text-right font-mono">
                  <span className="text-[10px] text-slate-400 block uppercase">Retention Expiry:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{doc.retentionEndDate}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setScheduledReviewMsg(`Scheduled controlled disposal audit review for #${doc.documentNumber} (${doc.title}).`)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap"
                >
                  Schedule Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
