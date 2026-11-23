import React from 'react';
import { useArchive } from '../context/ArchiveContext';
import { PageHeader } from '../components/common/PageHeader';
import {
  FileText,
  Building2,
  ArrowRightLeft,
  AlertTriangle,
  PlusCircle,
  QrCode,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  HardDrive,
  PenLine,
  UserCheck,
  type LucideIcon
} from 'lucide-react';

interface DashboardPageProps {
  onOpenScanner: () => void;
  onOpenRegisterDoc: () => void;
  onOpenCreateLocation: () => void;
  onSelectDocument: (docId: string) => void;
}

interface AttentionItem {
  key: string;
  icon: LucideIcon;
  iconClasses: string;
  label: string;
  detail: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenScanner,
  onOpenRegisterDoc,
  onOpenCreateLocation,
  onSelectDocument
}) => {
  const {
    documents, locations, checkouts, movements, departments,
    currentUser, pendingUsersCount, setActiveTab
  } = useArchive();

  // Metrics
  const totalDocs = documents.length;
  const checkedOutDocs = documents.filter(d => d.status === 'CHECKED_OUT');
  const overdueCheckouts = checkouts.filter(c => c.status === 'OVERDUE');
  const pendingRequests = checkouts.filter(c => c.status === 'REQUESTED');
  const availableDocs = documents.filter(d => d.status === 'AVAILABLE');
  const draftDocs = documents.filter(d => d.status === 'DRAFT');
  const digitalDocs = documents.filter(d => d.hasDigitalCopy);
  const totalLocations = locations.length;
  const totalBoxes = locations.filter(l => l.type === 'BOX').length;
  const totalFolders = locations.filter(l => l.type === 'FOLDER').length;
  const totalCabinets = locations.filter(l => l.type === 'CABINET').length;

  // Retention snapshot: real expiry data instead of a promotional panel.
  const today = new Date();
  const in90Days = new Date();
  in90Days.setDate(in90Days.getDate() + 90);
  const activeDocs = documents.filter(d => d.status !== 'DISPOSED');
  const expiredRetention = activeDocs.filter(d => d.retentionEndDate && new Date(d.retentionEndDate) < today);
  const expiringSoon = activeDocs.filter(d => {
    if (!d.retentionEndDate) return false;
    const end = new Date(d.retentionEndDate);
    return end >= today && end <= in90Days;
  });

  const goTo = (tab: string) => setActiveTab(tab);

  // Actionable worklist — the first thing a records officer should see.
  const attentionItems: AttentionItem[] = [
    {
      key: 'overdue',
      icon: AlertTriangle,
      iconClasses: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
      label: 'Overdue loans',
      detail: 'Borrowed documents past their due return date.',
      count: overdueCheckouts.length,
      actionLabel: 'Review loans',
      onAction: () => goTo('checkouts')
    },
    {
      key: 'requests',
      icon: Clock,
      iconClasses: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
      label: 'Checkout requests awaiting approval',
      detail: 'Requests submitted by departments, pending review.',
      count: pendingRequests.length,
      actionLabel: 'Review requests',
      onAction: () => goTo('checkouts')
    },
    {
      key: 'drafts',
      icon: PenLine,
      iconClasses: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      label: 'Incomplete drafts',
      detail: 'Captured records missing required filing information.',
      count: draftDocs.length,
      actionLabel: 'Complete drafts',
      onAction: () => goTo('documents')
    },
    {
      key: 'users',
      icon: UserCheck,
      iconClasses: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      label: 'User accounts awaiting approval',
      detail: 'New registrations need administrator approval.',
      count: currentUser.role === 'ADMIN' ? pendingUsersCount : 0,
      actionLabel: 'Manage users',
      onAction: () => goTo('settings')
    }
  ].filter(item => item.count > 0);

  const kpis = [
    {
      key: 'total',
      label: 'Total records',
      value: totalDocs,
      sub: `${digitalDocs.length} with digital copies`,
      subIcon: HardDrive,
      icon: FileText,
      iconClasses: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400',
      onClick: () => goTo('documents')
    },
    {
      key: 'available',
      label: 'Available in archive',
      value: availableDocs.length,
      sub: 'Ready for lookup & checkout',
      icon: CheckCircle2,
      iconClasses: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
      onClick: () => goTo('documents')
    },
    {
      key: 'checkedout',
      label: 'Checked out',
      value: checkedOutDocs.length,
      sub: overdueCheckouts.length > 0 ? `${overdueCheckouts.length} overdue` : 'All within due dates',
      subClasses: overdueCheckouts.length > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : undefined,
      icon: ArrowRightLeft,
      iconClasses: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      onClick: () => goTo('checkouts')
    },
    {
      key: 'storage',
      label: 'Storage nodes',
      value: totalLocations,
      sub: `${totalCabinets} cabinets · ${totalBoxes} boxes · ${totalFolders} folders`,
      icon: Building2,
      iconClasses: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
      onClick: () => goTo('locations')
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      <PageHeader
        title="Archive overview"
        description="Monitor records, storage, circulation, and retention activity."
        icon={LayoutDashboard}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onOpenRegisterDoc} className="btn-primary">
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              Register document
            </button>
            <button type="button" onClick={onOpenScanner} className="btn-secondary">
              <QrCode className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              Scan tag
            </button>
            <button type="button" onClick={onOpenCreateLocation} className="btn-ghost">
              <Building2 className="w-4 h-4" aria-hidden="true" />
              Add location
            </button>
          </div>
        }
      />

      {/* Needs attention — actionable worklist, highest priority */}
      {attentionItems.length > 0 && (
        <section className="card p-4 sm:p-5" aria-label="Items needing attention">
          <h2 className="section-title mb-3">Needs attention</h2>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {attentionItems.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`p-2 rounded-lg shrink-0 ${item.iconClasses}`}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {item.count} {item.label.toLowerCase()}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
                  </div>
                  <button type="button" onClick={item.onAction} className="btn-secondary btn-sm self-start sm:self-center">
                    {item.actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI cards — each opens its module */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          const SubIcon = kpi.subIcon;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={kpi.onClick}
              className="card p-4 text-left space-y-2 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{kpi.label}</span>
                <span className={`p-1.5 rounded-lg ${kpi.iconClasses}`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{kpi.value}</div>
              <div className={`text-[11px] flex items-center gap-1 ${kpi.subClasses || 'text-zinc-400 dark:text-zinc-500'}`}>
                {SubIcon && <SubIcon className="w-3 h-3" aria-hidden="true" />}
                {kpi.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent activity & department breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <section className="lg:col-span-2 card p-4 sm:p-5 min-w-0" aria-label="Recent activity">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h2 className="section-title">Recent activity</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Latest transfers, check-outs, and returns</p>
            </div>
            <button
              type="button"
              onClick={() => goTo('audit')}
              className="text-xs font-medium text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300 flex items-center gap-1 flex-shrink-0"
            >
              Full ledger
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {movements.length === 0 ? (
            <div className="empty-state">No recent archive activity.</div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {movements.slice(0, 5).map(mvt => (
                <button
                  key={mvt.id}
                  type="button"
                  onClick={() => onSelectDocument(mvt.documentId)}
                  aria-label={`Open document #${mvt.documentNumber}: ${mvt.documentTitle}`}
                  className="w-full text-left py-3 space-y-1.5 min-w-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs min-w-0">
                    <span className="flex items-center gap-2 min-w-0 max-w-full">
                      <span className="font-mono font-semibold text-teal-600 dark:text-teal-400 flex-shrink-0">
                        #{mvt.documentNumber}
                      </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate" title={mvt.documentTitle}>
                        {mvt.documentTitle}
                      </span>
                    </span>
                    <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 uppercase flex-shrink-0">
                      {mvt.movementType}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 min-w-0">
                    <span className="truncate" title={mvt.fromLocationPath}>{mvt.fromLocationPath}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400 hidden sm:block flex-shrink-0" aria-hidden="true" />
                    <span className="truncate font-medium text-zinc-700 dark:text-zinc-300" title={mvt.toLocationPath}>{mvt.toLocationPath}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 min-w-0">
                    <span className="truncate">by <span className="text-zinc-600 dark:text-zinc-300 font-medium">{mvt.performedByUserName}</span></span>
                    <span className="font-mono flex-shrink-0">{new Date(mvt.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">

          <section className="card p-4 sm:p-5 space-y-4" aria-label="Department distribution">
            <h2 className="section-title">Records by department</h2>
            {departments.length === 0 ? (
              <p className="text-xs text-zinc-400">No departments configured.</p>
            ) : (
              <div className="space-y-3">
                {departments.map(dept => {
                  const count = documents.filter(d => d.departmentId === dept.id).length;
                  const percentage = totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0;
                  return (
                    <div key={dept.id} className="space-y-1 text-xs">
                      <div className="flex justify-between gap-2 font-medium">
                        <span className="text-zinc-700 dark:text-zinc-300 truncate">{dept.name}</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-100 flex-shrink-0">{count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full"
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card p-4 sm:p-5 space-y-3" aria-label="Retention snapshot">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2 className="section-title">Retention snapshot</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 py-2.5">
                <div className="text-lg font-semibold text-rose-700 dark:text-rose-400">{expiredRetention.length}</div>
                <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80">Past retention expiry</div>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 py-2.5">
                <div className="text-lg font-semibold text-amber-700 dark:text-amber-400">{expiringSoon.length}</div>
                <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80">Expiring within 90 days</div>
              </div>
            </div>
            <button type="button" onClick={() => goTo('retention')} className="btn-secondary btn-sm w-full">
              View retention
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </section>

        </div>

      </div>

    </div>
  );
};