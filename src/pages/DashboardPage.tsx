import React from 'react';
import { useArchive } from '../context/ArchiveContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { 
  FileText, 
  Building2, 
  ArrowRightLeft, 
  AlertTriangle, 
  PlusCircle, 
  QrCode, 
  Folder, 
  Box, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  MapPin,
  TrendingUp,
  HardDrive
} from 'lucide-react';

interface DashboardPageProps {
  onOpenScanner: () => void;
  onOpenRegisterDoc: () => void;
  onOpenCreateLocation: () => void;
  onSelectDocument: (docId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenScanner,
  onOpenRegisterDoc,
  onOpenCreateLocation,
  onSelectDocument
}) => {
  const { documents, locations, checkouts, movements, departments, setActiveTab } = useArchive();

  // Metrics Calculations
  const totalDocs = documents.length;
  const checkedOutDocs = documents.filter(d => d.status === 'CHECKED_OUT');
  const overdueCheckouts = checkouts.filter(c => c.status === 'OVERDUE');
  const availableDocs = documents.filter(d => d.status === 'AVAILABLE');
  const digitalDocs = documents.filter(d => d.hasDigitalCopy);
  const totalLocations = locations.length;
  
  const totalBoxes = locations.filter(l => l.type === 'BOX').length;
  const totalFolders = locations.filter(l => l.type === 'FOLDER').length;
  const totalCabinets = locations.filter(l => l.type === 'CABINET').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-mono font-bold border border-indigo-500/30">
              <Building2 className="w-3.5 h-3.5" />
              Physical & Digital Records Vault
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Archive Command Dashboard
            </h1>
            <p className="text-sm text-indigo-200/80 leading-relaxed">
              Track physical hard-copy document positions, hierarchical storage structures, circulation borrowing history, and regulatory retention lifecycles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onOpenRegisterDoc}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
            >
              <PlusCircle className="w-4 h-4" />
              Register Document
            </button>

            <button
              type="button"
              onClick={onOpenCreateLocation}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs rounded-xl border border-slate-700 transition-all"
            >
              <Building2 className="w-4 h-4" />
              Add Storage Unit
            </button>

            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 transition-all"
            >
              <QrCode className="w-4 h-4 text-indigo-300" />
              Scan QR / Barcode
            </button>
          </div>
        </div>
      </div>

      {/* Overdue Warning Alert Banner if any overdue */}
      {overdueCheckouts.length > 0 && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl dark:bg-rose-950/50 dark:border-rose-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500 text-white rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-rose-950 dark:text-rose-100 text-sm">
                Attention: {overdueCheckouts.length} Borrowed Document(s) Are Overdue
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Documents checked out have exceeded their expected return date. Please contact the borrowing department.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('checkouts')}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            Manage Overdue Records →
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Total Registered Records</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{totalDocs}</span>
            <span className="text-xs text-emerald-600 font-medium">Physical Items</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
            <HardDrive className="w-3 h-3 text-indigo-500" />
            <span>{digitalDocs.length} with attached digital file copies</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Available in Archive</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{availableDocs.length}</span>
            <span className="text-xs text-slate-500">Ready for lookup</span>
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            Stored in home cabinets & boxes
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Checked Out / Borrowed</span>
            <div className="p-2 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 rounded-xl">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{checkedOutDocs.length}</span>
            <span className="text-xs text-amber-600 font-semibold">{overdueCheckouts.length} Overdue</span>
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            Active in department desks
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Storage Hierarchy Nodes</span>
            <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{totalLocations}</span>
            <span className="text-xs text-slate-500">Nodes</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>{totalCabinets} Cabinets</span>
            <span>{totalBoxes} Boxes</span>
            <span>{totalFolders} Folders</span>
          </div>
        </div>

      </div>

      {/* Main Content Grid: Recent Movements & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Physical Movement History Ledger (2 columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate">
                Recent Physical Document Movements
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Audit ledger of physical transfers, check-outs, and returns
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 flex items-center gap-1 flex-shrink-0"
            >
              Full Ledger →
            </button>
          </div>

          <div className="space-y-3 min-w-0">
            {movements.slice(0, 5).map(mvt => (
              <div
                key={mvt.id}
                onClick={() => onSelectDocument(mvt.documentId)}
                className="p-3 sm:p-3.5 bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/60 transition-all cursor-pointer space-y-2.5 min-w-0 overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs min-w-0">
                  <div className="flex items-center gap-2 min-w-0 max-w-full">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      #{mvt.documentNumber}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={mvt.documentTitle}>
                      {mvt.documentTitle}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex-shrink-0">
                    {mvt.movementType}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex-shrink-0">From:</span>
                    <span className="text-[11px] truncate text-slate-600 dark:text-slate-300" title={mvt.fromLocationPath}>
                      {mvt.fromLocationPath}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden sm:block flex-shrink-0" />
                  <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex-shrink-0">To:</span>
                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 truncate" title={mvt.toLocationPath}>
                      {mvt.toLocationPath}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400 min-w-0">
                  <span className="truncate">Moved by: <strong className="text-slate-700 dark:text-slate-300">{mvt.performedByUserName}</strong></span>
                  <span className="font-mono flex-shrink-0">{new Date(mvt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Department Document Distribution & Quick Stats (1 column) */}
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Department Archives
            </h3>

            <div className="space-y-3">
              {departments.map(dept => {
                const count = documents.filter(d => d.departmentId === dept.id).length;
                const percentage = totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0;

                return (
                  <div key={dept.id} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-700 dark:text-slate-300">{dept.name}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{count} docs ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-bold text-indigo-950 dark:text-indigo-100 text-sm">
                Regulatory Retention Engine
              </h4>
            </div>
            <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
              Automated document lifecycle policies calculate retention expiry dates based on document type standards (e.g. Contracts 15 yrs, Audits 10 yrs).
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('retention')}
              className="w-full py-2 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              View Retention Policies →
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
