import React, { useState } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { ProfileModal } from '../auth/ProfileModal';
import { 
  Archive, 
  Search, 
  QrCode, 
  Bell, 
  User as UserIcon, 
  ShieldCheck, 
  ChevronDown, 
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  LogOut,
  Settings,
  Menu,
  Truck
} from 'lucide-react';

interface HeaderProps {
  onOpenScanner: () => void;
  onOpenBatchRelocate?: () => void;
  onOpenMobileMenu?: () => void;
  onSelectTab?: (tabId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onOpenScanner,
  onOpenBatchRelocate,
  onOpenMobileMenu,
  onSelectTab 
}) => {
  const { 
    currentUser, 
    setCurrentUser, 
    availableUsers, 
    logoutUser,
    globalSearchQuery, 
    setGlobalSearchQuery, 
    notifications, 
    dismissNotification,
    setActiveTab,
    checkouts
  } = useArchive();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const overdueCount = checkouts.filter(c => c.status === 'OVERDUE').length;

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Mobile Hamburger & Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Hamburger Menu Button on Mobile */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors md:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none min-w-0" 
            onClick={() => {
              setActiveTab('dashboard');
              if (onSelectTab) onSelectTab('dashboard');
            }}
          >
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-xl shadow-md shadow-indigo-500/20 flex-shrink-0">
              <Archive className="w-4 h-4 sm:w-5 sm:h-5" />
              {/* <img src="/assets/favicon.png" alt="ArchiveHub" className="w-4 h-4 sm:w-5 sm:h-5" /> */}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg tracking-tight truncate">
                  ArchiveHub
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded border border-indigo-200/60 dark:border-indigo-800 hidden xs:inline-block">
                  PDAMS
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block">
                Physical & Digital Archive Management System
              </span>
            </div>
          </div>
        </div>

        {/* Global Search Input on Desktop (Hidden on mobile) */}
        <div className="flex-1 max-w-md relative hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => {
                setGlobalSearchQuery(e.target.value);
                if (e.target.value.trim().length > 0) {
                  setActiveTab('documents');
                  if (onSelectTab) onSelectTab('documents');
                }
              }}
              placeholder="Global Search (Doc #, Title, Ref, Location, Cabinet, Box)..."
              className="w-full pl-10 pr-10 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl outline-none transition-all shadow-inner"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          
          {/* Mobile Search Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors md:hidden"
            aria-label="Toggle search bar"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* QR Camera Scanner Trigger */}
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800 rounded-xl transition-all shadow-xs"
            title="Scan physical location tag or document QR code"
          >
            <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Scan Tag / QR</span>
          </button>

          {/* Batch Relocate Trigger */}
          {onOpenBatchRelocate && (
            <button
              type="button"
              onClick={onOpenBatchRelocate}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 rounded-xl transition-all shadow-xs"
              title="Batch relocate documents by scanning QR codes"
            >
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Batch Relocate</span>
            </button>
          )}

          {/* Notifications Center */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors relative"
              title="System Alerts & Notifications"
            >
              <Bell className="w-5 h-5" />
              {(notifications.length > 0 || overdueCount > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-ping" />
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Notifications & Alerts
                  </span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    {notifications.length}
                  </span>
                </div>

                {overdueCount > 0 && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Overdue Warning</span>
                      <span>{overdueCount} document(s) exceed their due return date.</span>
                    </div>
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center italic">No new notifications</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="pt-2 flex items-start justify-between gap-2 text-xs">
                        <div className="flex items-start gap-2">
                          {n.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />}
                          {n.type === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />}
                          {n.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />}
                          <div>
                            <p className="text-slate-800 dark:text-slate-200">{n.message}</p>
                            <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => dismissNotification(n.id)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Role Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/80 dark:border-slate-700 min-h-[38px]"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[120px]">
                  {currentUser.fullName}
                </span>
                <span className="block text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold leading-none">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="block font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{currentUser.fullName}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{currentUser.email}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded uppercase flex-shrink-0">
                    {currentUser.role}
                  </span>
                </div>

                <div className="px-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                    Switch Active Persona
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {availableUsers.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setCurrentUser(u);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          u.id === currentUser.id
                            ? 'bg-indigo-50 text-indigo-900 font-semibold dark:bg-indigo-950/60 dark:text-indigo-200'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="truncate">
                          <span className="block font-medium truncate">{u.fullName}</span>
                          <span className="text-[10px] text-slate-500 truncate">{u.departmentName}</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold uppercase bg-slate-200/70 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-400 flex-shrink-0 ml-1">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileModal(true);
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    My Profile & Account
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      if (onSelectTab) onSelectTab('settings');
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    System & Account Settings
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      logoutUser();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Expandable Mobile Search Bar (Revealed when search icon clicked on mobile) */}
      {showMobileSearch && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800 md:hidden bg-slate-50/90 dark:bg-slate-900/90 animate-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={globalSearchQuery}
              onChange={(e) => {
                setGlobalSearchQuery(e.target.value);
                if (e.target.value.trim().length > 0) {
                  setActiveTab('documents');
                  if (onSelectTab) onSelectTab('documents');
                }
              }}
              placeholder="Search Doc #, title, ref, cabinet, box..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-slate-100 focus:border-indigo-500 shadow-sm"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      {/* My Profile Modal */}
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </header>
  );
};
