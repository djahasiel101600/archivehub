import React from 'react';
import { DocumentStatus, ConfidentialityLevel, DocumentCondition, CheckoutStatus } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  ArrowRightLeft, 
  AlertTriangle, 
  Archive, 
  ShieldAlert, 
  ShieldCheck, 
  Eye, 
  XCircle,
  FileCheck
} from 'lucide-react';

interface StatusBadgeProps {
  type: 'status' | 'confidentiality' | 'condition' | 'checkout';
  value: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, size = 'md' }) => {
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3 py-1 text-sm font-semibold' : 'px-2.5 py-1 text-xs font-medium';

  if (type === 'status') {
    const status = value as DocumentStatus;
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50 ${px}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Available
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50 ${px}`}>
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Checked Out
          </span>
        );
      case 'REQUESTED':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50 ${px}`}>
            <Clock className="w-3.5 h-3.5" />
            Requested
          </span>
        );
      case 'APPROVED':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/50 ${px}`}>
            <FileCheck className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50 ${px}`}>
            <ArrowRightLeft className="w-3.5 h-3.5 animate-pulse" />
            In Transit
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 ${px}`}>
            <Archive className="w-3.5 h-3.5" />
            Archived
          </span>
        );
      case 'FOR_DISPOSAL':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 ${px}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            For Disposal
          </span>
        );
      case 'DISPOSED':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-300 ${px}`}>
            <XCircle className="w-3.5 h-3.5" />
            Disposed
          </span>
        );
      default:
        return <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 ${px}`}>{value}</span>;
    }
  }

  if (type === 'checkout') {
    const chk = value as CheckoutStatus;
    switch (chk) {
      case 'OVERDUE':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 ${px} animate-pulse`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            OVERDUE
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${px}`}>
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Active Checkout
          </span>
        );
      case 'REQUESTED':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${px}`}>
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
      case 'RETURNED':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${px}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Returned
          </span>
        );
      default:
        return <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 ${px}`}>{value}</span>;
    }
  }

  if (type === 'confidentiality') {
    const conf = value as ConfidentialityLevel;
    switch (conf) {
      case 'RESTRICTED':
        return (
          <span className={`inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 ${px}`}>
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            Restricted
          </span>
        );
      case 'CONFIDENTIAL':
        return (
          <span className={`inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 ${px}`}>
            <ShieldCheck className="w-3 h-3 text-amber-600" />
            Confidential
          </span>
        );
      case 'INTERNAL':
        return (
          <span className={`inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${px}`}>
            <Eye className="w-3 h-3 text-slate-500" />
            Internal Only
          </span>
        );
      case 'PUBLIC':
      default:
        return (
          <span className={`inline-flex items-center gap-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200 ${px}`}>
            Public
          </span>
        );
    }
  }

  if (type === 'condition') {
    const cond = value as DocumentCondition;
    switch (cond) {
      case 'EXCELLENT':
        return <span className={`inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 font-medium ${px}`}>Excellent</span>;
      case 'GOOD':
        return <span className={`inline-flex items-center rounded-md bg-slate-100 text-slate-700 font-medium ${px}`}>Good</span>;
      case 'FAIR':
        return <span className={`inline-flex items-center rounded-md bg-amber-50 text-amber-700 font-medium ${px}`}>Fair</span>;
      case 'DAMAGED':
        return <span className={`inline-flex items-center rounded-md bg-orange-100 text-orange-800 font-bold ${px}`}>⚠ Damaged</span>;
      case 'MISSING':
        return <span className={`inline-flex items-center rounded-md bg-red-100 text-red-800 font-bold ${px}`}>❌ MISSING</span>;
    }
  }

  return <span className={`inline-flex items-center rounded bg-gray-100 ${px}`}>{value}</span>;
};
