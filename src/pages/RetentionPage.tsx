import React, { useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { PageHeader } from '../components/common/PageHeader';
import { ShieldCheck, CalendarClock } from 'lucide-react';

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
        <div className="card border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/60 p-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-teal-800 dark:text-teal-200">{scheduledReviewMsg}</span>
          <button
            type="button"
            onClick={() => setScheduledReviewMsg(null)}
            className="btn btn-ghost btn-xs shrink-0 text-teal-700 dark:text-teal-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Retention Policies */}
      <section className="card p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="section-title">Active statutory retention schedules</h3>
          <p className="meta mt-0.5">Retention periods defined per document type.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {documentTypes.map(dt => (
            <div key={dt.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{dt.name}</span>
                <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 shrink-0">
                  {dt.retentionYears} years
                </span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                {dt.description || `${dt.name} statutory archiving schedule.`}
              </p>
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-400">
                Disposal: {dt.retentionYears >= 50 ? 'Permanent national archive' : 'Controlled secure destruction'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Records approaching retention review */}
      <section className="card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="section-title">Records scheduled for retention review</h3>
            <p className="meta mt-0.5">Expiring within the next five years.</p>
          </div>
          <span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
            {expiringSoonDocs.length} records
          </span>
        </div>

        {expiringSoonDocs.length === 0 ? (
          <div className="empty-state">
            <CalendarClock className="w-6 h-6 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p>No records are scheduled for retention review in the next five years.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {expiringSoonDocs.map(doc => (
              <div key={doc.id} className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-medium text-teal-600 dark:text-teal-400 shrink-0">#{doc.documentNumber}</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{doc.title}</span>
                  </div>
                  <p className="meta mt-0.5 truncate">
                    {doc.documentTypeName} · {doc.departmentName}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <span className="meta block">Retention expiry</span>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{doc.retentionEndDate}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScheduledReviewMsg(`Scheduled controlled disposal audit review for #${doc.documentNumber} (${doc.title}).`)}
                    className="btn btn-secondary btn-sm"
                  >
                    Schedule review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};