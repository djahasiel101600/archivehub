import React, { useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  ArrowRightLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  RotateCcw, 
  FileText, 
  User as UserIcon, 
  Calendar,
  Building2,
  Check,
  X
} from 'lucide-react';

interface CheckoutsPageProps {
  onSelectDocument: (docId: string) => void;
}

export const CheckoutsPage: React.FC<CheckoutsPageProps> = ({ onSelectDocument }) => {
  const { 
    checkouts, 
    documents, 
    locations,
    approveCheckout, 
    rejectCheckout, 
    processCheckoutDispatch, 
    processCheckInReturn,
    calculatePath
  } = useArchive();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'overdue' | 'returned'>('all');
  
  // Return Modal State
  const [returnChkId, setReturnChkId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Archive Circulation & Borrowing Desk
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage borrowing requests, dispatch custody releases, track overdue items, and process returns
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs font-medium">
        <div 
          onClick={() => setActiveTab('pending')}
          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'pending'
              ? 'bg-blue-50 border-blue-300 dark:bg-blue-950/60'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex justify-between items-center text-slate-500">
            <span className="truncate pr-1">Pending</span>
            <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
            {pendingList.length}
          </span>
        </div>

        <div 
          onClick={() => setActiveTab('active')}
          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'active'
              ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/60'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex justify-between items-center text-slate-500">
            <span className="truncate pr-1">Active</span>
            <ArrowRightLeft className="w-4 h-4 text-amber-500 flex-shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
            {activeList.length}
          </span>
        </div>

        <div 
          onClick={() => setActiveTab('overdue')}
          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'overdue'
              ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/60'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-rose-600 font-bold truncate pr-1">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse flex-shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-rose-600 mt-1 block">
            {overdueList.length}
          </span>
        </div>

        <div 
          onClick={() => setActiveTab('returned')}
          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'returned'
              ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/60'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex justify-between items-center text-slate-500">
            <span className="truncate pr-1">Returned</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
            {returnedList.length}
          </span>
        </div>
      </div>

      {/* Circulation Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm space-y-4 p-4 sm:p-5">
        
        {/* Filter Bar */}
        <div className="flex items-center overflow-x-auto pb-3 gap-1.5 sm:gap-2 text-xs font-semibold border-b border-slate-100 dark:border-slate-800 flex-nowrap sm:flex-wrap no-scrollbar">
          {(['all', 'pending', 'active', 'overdue', 'returned'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-xl capitalize transition-all whitespace-nowrap flex-shrink-0 min-h-[36px] ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab} ({tab === 'all' ? checkouts.length : tab === 'pending' ? pendingList.length : tab === 'active' ? activeList.length : tab === 'overdue' ? overdueList.length : returnedList.length})
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredCheckouts.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-8 text-center">No circulation records under this view.</p>
          ) : (
            filteredCheckouts.map(chk => {
              const doc = documents.find(d => d.id === chk.documentId);

              return (
                <div
                  key={chk.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        #{chk.documentNumber}
                      </span>
                      <h4
                        onClick={() => onSelectDocument(chk.documentId)}
                        className="font-bold text-slate-900 dark:text-slate-100 text-sm hover:underline cursor-pointer"
                      >
                        {chk.documentTitle}
                      </h4>
                    </div>

                    <StatusBadge type="checkout" value={chk.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Borrower:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {chk.requestedByUserName} ({chk.requestedByDepartment})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Purpose:</span>
                      <span className="text-slate-700 dark:text-slate-300 line-clamp-1">{chk.purpose}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Due Date:</span>
                      <span className={`font-mono font-bold ${chk.status === 'OVERDUE' ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {chk.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {chk.status === 'REQUESTED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => rejectCheckout(chk.id, 'Request rejected by Records Officer')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            approveCheckout(chk.id);
                            processCheckoutDispatch(chk.id);
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve & Release Custody
                        </button>
                      </>
                    )}

                    {(chk.status === 'CHECKED_OUT' || chk.status === 'OVERDUE') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (doc) processCheckInReturn(chk.id, doc.condition, doc.homeLocationId, 'Checked in at Circulation Desk');
                        }}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Process Check-In Return
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
};
