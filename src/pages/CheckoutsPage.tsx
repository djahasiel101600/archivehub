import React, { useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { DocumentCondition } from '../types';
import {
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Check,
  X
} from 'lucide-react';

interface CheckoutsPageProps {
  onSelectDocument: (docId: string) => void;
}

type CirculationTab = 'all' | 'pending' | 'active' | 'overdue' | 'returned';

const CONDITIONS: DocumentCondition[] = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'MISSING'];

export const CheckoutsPage: React.FC<CheckoutsPageProps> = ({ onSelectDocument }) => {
  const {
    checkouts,
    documents,
    approveCheckout,
    rejectCheckout,
    processCheckoutDispatch,
    processCheckInReturn
  } = useArchive();

  const [activeTab, setActiveTab] = useState<CirculationTab>('all');

  // Check-in return dialog state
  const [returnChkId, setReturnChkId] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState<DocumentCondition>('GOOD');
  const [returnNotes, setReturnNotes] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  // Reject confirmation state
  const [rejectChkId, setRejectChkId] = useState<string | null>(null);

  const pendingList = checkouts.filter(c => c.status === 'REQUESTED');
  const activeList = checkouts.filter(c => c.status === 'CHECKED_OUT');
  const overdueList = checkouts.filter(c => c.status === 'OVERDUE');
  const returnedList = checkouts.filter(c => c.status === 'RETURNED');

  const filteredCheckouts = checkouts.filter(c => {
    if (activeTab === 'pending') return c.status === 'REQUESTED';
    if (activeTab === 'active') return c.status === 'CHECKED_OUT';
    if (activeTab === 'overdue') return c.status === 'OVERDUE';
    if (activeTab === 'returned') return c.status === 'RETURNED';
    return true;
  });

  const tabs: { id: CirculationTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: checkouts.length },
    { id: 'pending', label: 'Pending', count: pendingList.length },
    { id: 'active', label: 'Active', count: activeList.length },
    { id: 'overdue', label: 'Overdue', count: overdueList.length },
    { id: 'returned', label: 'Returned', count: returnedList.length }
  ];

  const returnCheckout = returnChkId ? checkouts.find(c => c.id === returnChkId) : null;
  const returnDoc = returnCheckout ? documents.find(d => d.id === returnCheckout.documentId) : null;

  const openReturnDialog = (chkId: string) => {
    const chk = checkouts.find(c => c.id === chkId);
    const doc = chk ? documents.find(d => d.id === chk.documentId) : null;
    setReturnCondition(doc?.condition || 'GOOD');
    setReturnNotes('');
    setReturnChkId(chkId);
  };

  const confirmReturn = async () => {
    if (!returnCheckout || !returnDoc || isReturning) return;
    setIsReturning(true);
    try {
      await processCheckInReturn(
        returnCheckout.id,
        returnCondition,
        returnDoc.homeLocationId,
        returnNotes.trim() || 'Checked in at Circulation Desk'
      );
      setReturnChkId(null);
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      <PageHeader
        icon={ArrowRightLeft}
        title="Circulation Desk"
        description="Manage requests, current loans, overdue records, and returns."
      />

      {/* Single segmented control: counts + filtering in one place */}
      <div className="flex items-center overflow-x-auto gap-1.5 text-xs font-medium no-scrollbar" role="tablist" aria-label="Circulation views">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const isOverdueTab = tab.id === 'overdue' && tab.count > 0;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 min-h-[36px] inline-flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.id === 'overdue' && <AlertTriangle className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-rose-500'}`} aria-hidden="true" />}
              {tab.id === 'pending' && <Clock className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-sky-500'}`} aria-hidden="true" />}
              {tab.id === 'active' && <ArrowRightLeft className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-amber-500'}`} aria-hidden="true" />}
              {tab.id === 'returned' && <CheckCircle2 className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-500'}`} aria-hidden="true" />}
              {tab.label}
              <span className={`chip ${
                isActive
                  ? 'bg-white/20 text-white'
                  : isOverdueTab
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Circulation list */}
      <div className="card overflow-hidden">
        {filteredCheckouts.length === 0 ? (
          <div className="empty-state">
            <ArrowRightLeft className="w-8 h-8 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="font-medium text-zinc-700 dark:text-zinc-300">No circulation records under this view</p>
            <p className="text-xs">Requests, loans and returns will appear here as they are created.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredCheckouts.map(chk => (
              <div key={chk.id} className="p-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold text-teal-600 dark:text-teal-400 flex-shrink-0">
                      #{chk.documentNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectDocument(chk.documentId)}
                      className="font-medium text-zinc-900 dark:text-zinc-100 text-sm hover:text-teal-600 dark:hover:text-teal-400 hover:underline text-left truncate"
                    >
                      {chk.documentTitle}
                    </button>
                  </div>
                  <StatusBadge type="checkout" value={chk.status} size="sm" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Borrower</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                      {chk.requestedByUserName} ({chk.requestedByDepartment})
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Purpose</span>
                    <span className="text-zinc-700 dark:text-zinc-300 line-clamp-1">{chk.purpose}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Due date</span>
                    <span className={`font-mono font-medium ${chk.status === 'OVERDUE' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {chk.dueDate}
                      {chk.status === 'OVERDUE' && ' · overdue'}
                    </span>
                  </div>
                </div>

                {(chk.status === 'REQUESTED' || chk.status === 'CHECKED_OUT' || chk.status === 'OVERDUE') && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                    {chk.status === 'REQUESTED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectChkId(chk.id)}
                          className="btn-danger-outline btn-sm"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            approveCheckout(chk.id);
                            processCheckoutDispatch(chk.id);
                          }}
                          className="btn-primary btn-sm"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          Approve & Release
                        </button>
                      </>
                    )}

                    {(chk.status === 'CHECKED_OUT' || chk.status === 'OVERDUE') && (
                      <button
                        type="button"
                        onClick={() => openReturnDialog(chk.id)}
                        className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        Check-In Return
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Check-in return dialog: verify condition before the record goes back */}
      {returnCheckout && returnDoc && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-3 px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex-shrink-0">
                  <RotateCcw className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Check-in return</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    #{returnCheckout.documentNumber} · {returnCheckout.documentTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnChkId(null)}
                aria-label="Close return dialog"
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-3 space-y-4 overflow-y-auto flex-1 text-sm">
              <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                <p>
                  Borrowed by <span className="font-medium">{returnCheckout.requestedByUserName}</span> ({returnCheckout.requestedByDepartment}), due <span className={`font-mono ${returnCheckout.status === 'OVERDUE' ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}`}>{returnCheckout.dueDate}</span>.
                </p>
                <p className="flex items-center gap-1.5 flex-wrap">
                  Returns to home storage:
                  <LocationPathBreadcrumbs locationId={returnDoc.homeLocationId} badgeSize="sm" />
                </p>
              </div>

              <div>
                <label htmlFor="return-condition" className="label">Condition on return</label>
                <select
                  id="return-condition"
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as DocumentCondition)}
                  className="input"
                >
                  {CONDITIONS.map(c => (
                    <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                  ))}
                </select>
                <p className="field-hint">Inspect the physical record before confirming. Damage or loss is recorded on the document.</p>
              </div>

              <div>
                <label htmlFor="return-notes" className="label">Notes (optional)</label>
                <input
                  id="return-notes"
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. returned with folded corner"
                  className="input"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end gap-2">
              <button type="button" onClick={() => setReturnChkId(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReturn}
                disabled={isReturning}
                className="btn bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                {isReturning ? 'Processing…' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={rejectChkId !== null}
        onClose={() => setRejectChkId(null)}
        onConfirm={() => {
          if (rejectChkId) rejectCheckout(rejectChkId, 'Request rejected by Records Officer');
        }}
        title="Reject checkout request?"
        message="The requesting department will be notified that this checkout request was rejected. The document remains available in the archive."
        confirmText="Reject Request"
        variant="danger"
      />

    </div>
  );
};