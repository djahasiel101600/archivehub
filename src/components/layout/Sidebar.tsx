import React, { useState } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { 
  LayoutDashboard, 
  Network, 
  FileText, 
  ArrowRightLeft, 
  ShieldCheck, 
  ClipboardList, 
  Settings, 
  Building2, 
  AlertTriangle,
  RotateCcw,
  X,
  Archive,
  LogOut,
  ChevronDown,
  User as UserIcon,
  Layers
} from 'lucide-react';

interface SidebarProps {
  onSelectTab?: (tabId: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { 
    activeTab, 
    setActiveTab, 
    documents, 
    locations, 
    checkouts, 
    bundles,
    resetDataToDefaults,
    currentUser,
    setCurrentUser,
    availableUsers,
    pendingUsersCount,
    logoutUser
  } = useArchive();

  const [showPersonaSwitcher, setShowPersonaSwitcher] = useState(false);

  const totalDocs = documents.length;
  const overdueDocs = checkouts.filter(c => c.status === 'OVERDUE').length;
  const pendingRequests = checkouts.filter(c => c.status === 'REQUESTED').length;
  const checkedOutCount = documents.filter(d => d.status === 'CHECKED_OUT').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Overview', icon: LayoutDashboard },
    { id: 'locations', label: 'Physical Storage Tree', icon: Network, badge: locations.length },
    { id: 'documents', label: 'Document Catalogue', icon: FileText, badge: totalDocs },
    { id: 'bundles', label: 'Bundles & Dossiers', icon: Layers, badge: bundles.length || undefined },
    { 
      id: 'checkouts', 
      label: 'Circulation Desk', 
      icon: ArrowRightLeft, 
      badge: overdueDocs > 0 ? `${overdueDocs} Overdue` : pendingRequests > 0 ? `${pendingRequests} Req` : checkedOutCount,
      badgeColor: overdueDocs > 0 ? 'bg-rose-500 text-white' : pendingRequests > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
    },
    { id: 'retention', label: 'Retention & Disposal', icon: ShieldCheck },
    { id: 'audit', label: 'Audit Trail Ledger', icon: ClipboardList },
    { 
      id: 'settings', 
      label: 'System Settings', 
      icon: Settings,
      badge: (currentUser.role === 'ADMIN' && pendingUsersCount > 0) ? `${pendingUsersCount} User${pendingUsersCount > 1 ? 's' : ''}` : undefined,
      badgeColor: 'bg-amber-500 text-white font-bold animate-pulse'
    }
  ];

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (onSelectTab) {
      onSelectTab(id);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      
      {/* Mobile Drawer Header with Close Button */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
            <Archive className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-sm text-white">ArchiveHub</span>
            <span className="text-[9px] font-mono text-indigo-400 block uppercase">Navigation Menu</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close Navigation Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 flex-1 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500">
          Archive Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                  item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active User Card & Quick Actions */}
      <div className="p-3 border-t border-slate-800 space-y-2 flex-shrink-0">
        
        {/* User Card with Persona Switcher */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-800 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-slate-200 truncate leading-tight">
                  {currentUser?.fullName || 'User'}
                </span>
                <span className="block text-[10px] font-mono text-indigo-400 font-semibold leading-none truncate">
                  {currentUser?.role} &bull; {currentUser?.departmentName || 'Staff'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPersonaSwitcher(!showPersonaSwitcher)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/60 transition-colors"
              title="Switch Persona"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showPersonaSwitcher ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showPersonaSwitcher && (
            <div className="pt-2 border-t border-slate-700/60 space-y-1 max-h-36 overflow-y-auto animate-in fade-in duration-150">
              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Switch User Persona
              </p>
              {availableUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setCurrentUser(u);
                    setShowPersonaSwitcher(false);
                  }}
                  className={`w-full text-left p-1.5 rounded-lg text-[11px] flex items-center justify-between transition-colors ${
                    u.id === currentUser?.id
                      ? 'bg-indigo-600/30 text-indigo-300 font-bold'
                      : 'hover:bg-slate-700/50 text-slate-300'
                  }`}
                >
                  <span className="truncate">{u.fullName}</span>
                  <span className="text-[9px] font-mono uppercase bg-slate-900 px-1 py-0.5 rounded text-slate-400">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="pt-1.5 border-t border-slate-700/60 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => {
                logoutUser();
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-lg text-[11px] font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>

            <button
              type="button"
              onClick={() => {
                resetDataToDefaults();
                if (onCloseMobile) onCloseMobile();
              }}
              className="py-1.5 px-2 bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg text-[11px] font-medium transition-colors"
              title="Reset demo dataset to initial PRD seed state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Visible >= md) */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col flex-shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer (Visible < md when opened) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />

          {/* Sliding Panel */}
          <div className="relative w-4/5 max-w-xs h-full z-10 shadow-2xl animate-in slide-in-from-left duration-250 flex flex-col">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
