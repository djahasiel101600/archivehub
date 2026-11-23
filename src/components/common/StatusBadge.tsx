import React from 'react';
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
  FileCheck,
  FilePlus2,
  FolderCheck,
  PenLine,
  Truck,
  type LucideIcon
} from 'lucide-react';

interface StatusBadgeProps {
  type: 'status' | 'confidentiality' | 'condition' | 'checkout';
  value: string;
  size?: 'sm' | 'md' | 'lg';
}

interface BadgeSpec {
  label: string;
  icon?: LucideIcon;
  classes: string;
}

/* Semantic color contract (shared across the app, per index.css tokens):
   emerald = ok/available, amber = out on loan/attention, sky = info/in-flight
   requests, rose = overdue/missing/damaged/destructive, violet = sealed/in
   transit, zinc = neutral or terminal. */
const tone = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
  sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60',
  violet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60',
  zinc: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  zincMuted: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700'
};

const STATUS_MAP: Record<string, BadgeSpec> = {
  DRAFT: { label: 'Draft', icon: PenLine, classes: tone.zinc },
  REGISTERED: { label: 'Registered', icon: FilePlus2, classes: tone.sky },
  FILED: { label: 'Filed', icon: FolderCheck, classes: tone.emerald },
  AVAILABLE: { label: 'Available', icon: CheckCircle2, classes: tone.emerald },
  REQUESTED: { label: 'Requested', icon: Clock, classes: tone.sky },
  APPROVED: { label: 'Approved', icon: FileCheck, classes: tone.sky },
  CHECKED_OUT: { label: 'Checked Out', icon: ArrowRightLeft, classes: tone.amber },
  IN_TRANSIT: { label: 'In Transit', icon: Truck, classes: tone.violet },
  RETURNED: { label: 'Returned', icon: CheckCircle2, classes: tone.emerald },
  MISSING: { label: 'Missing', icon: AlertTriangle, classes: tone.rose },
  DAMAGED: { label: 'Damaged', icon: AlertTriangle, classes: tone.rose },
  ARCHIVED: { label: 'Archived', icon: Archive, classes: tone.zinc },
  FOR_DISPOSAL: { label: 'For Disposal', icon: AlertTriangle, classes: tone.rose },
  DISPOSED: { label: 'Disposed', icon: XCircle, classes: tone.zincMuted }
};

const CHECKOUT_MAP: Record<string, BadgeSpec> = {
  REQUESTED: { label: 'Pending Approval', icon: Clock, classes: tone.sky },
  APPROVED: { label: 'Approved', icon: FileCheck, classes: tone.sky },
  REJECTED: { label: 'Rejected', icon: XCircle, classes: tone.rose },
  CHECKED_OUT: { label: 'Active Checkout', icon: ArrowRightLeft, classes: tone.amber },
  OVERDUE: { label: 'Overdue', icon: AlertTriangle, classes: tone.rose },
  RETURNED: { label: 'Returned', icon: CheckCircle2, classes: tone.emerald }
};

const CONFIDENTIALITY_MAP: Record<string, BadgeSpec> = {
  RESTRICTED: { label: 'Restricted', icon: ShieldAlert, classes: tone.rose },
  CONFIDENTIAL: { label: 'Confidential', icon: ShieldCheck, classes: tone.amber },
  INTERNAL: { label: 'Internal Only', icon: Eye, classes: tone.zinc },
  PUBLIC: { label: 'Public', icon: Eye, classes: tone.sky }
};

const CONDITION_MAP: Record<string, BadgeSpec> = {
  EXCELLENT: { label: 'Excellent', classes: tone.emerald },
  GOOD: { label: 'Good', classes: tone.zinc },
  FAIR: { label: 'Fair', classes: tone.amber },
  DAMAGED: { label: 'Damaged', icon: AlertTriangle, classes: tone.rose },
  MISSING: { label: 'Missing', icon: XCircle, classes: tone.rose }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, size = 'md' }) => {
  const px = size === 'sm'
    ? 'px-2 py-0.5 text-[11px]'
    : size === 'lg'
      ? 'px-3 py-1 text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-medium';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const map = type === 'status' ? STATUS_MAP
    : type === 'checkout' ? CHECKOUT_MAP
      : type === 'confidentiality' ? CONFIDENTIALITY_MAP
        : CONDITION_MAP;

  const spec = map[value];
  // Unknown values still render legibly instead of disappearing.
  const label = spec?.label ?? value;
  const classes = spec?.classes ?? tone.zinc;
  const Icon = spec?.icon;
  const rounded = type === 'confidentiality' || type === 'condition' ? 'rounded-md' : 'rounded-full';

  return (
    <span className={`inline-flex items-center gap-1.5 border whitespace-nowrap ${rounded} ${classes} ${px}`}>
      {Icon && <Icon className={`${iconSize} shrink-0`} aria-hidden="true" />}
      {label}
    </span>
  );
};