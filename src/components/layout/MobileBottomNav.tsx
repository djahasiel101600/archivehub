import React from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { 
  LayoutDashboard, 
  Network, 
  FileText, 
  ArrowRightLeft, 
  QrCode,
  Menu
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenScanner: () => void;
  onOpenMobileMenu: () => void;
  onSelectTab: (tabId: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenScanner,
  onOpenMobileMenu,
  onSelectTab
}) => {
  const { activeTab, checkouts, documents } = useArchive();

  const overdueDocs = checkouts.filter(c => c.status === 'OVERDUE').length;
  const pendingRequests = checkouts.filter(c => c.status === 'REQUESTED').length;
  const deskAlertCount = overdueDocs > 0 ? overdueDocs : pendingRequests;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 shadow-lg shadow-slate-950/10">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[56px] ${
            activeTab === 'dashboard'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-950/80' : ''}`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Overview</span>
        </button>

        {/* Storage Tree */}
        <button
          type="button"
          onClick={() => onSelectTab('locations')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[56px] ${
            activeTab === 'locations'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-lg transition-colors ${activeTab === 'locations' ? 'bg-indigo-50 dark:bg-indigo-950/80' : ''}`}>
            <Network className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Vault Tree</span>
        </button>

        {/* Center Scanner Action Button */}
        <button
          type="button"
          onClick={onOpenScanner}
          className="flex flex-col items-center justify-center -mt-4 group active:scale-95 transition-transform"
          aria-label="Scan QR or Barcode"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/40 flex items-center justify-center border-2 border-white dark:border-slate-900 group-hover:scale-105 transition-all">
            <QrCode className="w-6 h-6" />
          </div>
          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 uppercase tracking-wider">
            Scan
          </span>
        </button>

        {/* Documents */}
        <button
          type="button"
          onClick={() => onSelectTab('documents')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[56px] relative ${
            activeTab === 'documents'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-lg transition-colors ${activeTab === 'documents' ? 'bg-indigo-50 dark:bg-indigo-950/80' : ''}`}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Catalogue</span>
        </button>

        {/* Circulation Desk */}
        <button
          type="button"
          onClick={() => onSelectTab('checkouts')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[56px] relative ${
            activeTab === 'checkouts'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-lg transition-colors relative ${activeTab === 'checkouts' ? 'bg-indigo-50 dark:bg-indigo-950/80' : ''}`}>
            <ArrowRightLeft className="w-5 h-5" />
            {deskAlertCount > 0 && (
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                overdueDocs > 0 ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'
              }`} />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Circulation</span>
        </button>

        {/* More / Menu Drawer */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[56px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          aria-label="Open More Menu"
        >
          <div className="p-1 rounded-lg">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
        </button>

      </div>
    </div>
  );
};
