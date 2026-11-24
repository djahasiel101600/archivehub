import React, { useEffect, useRef, useState } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { ProfileModal } from '../auth/ProfileModal';
import {
  Archive,
  Search,
  QrCode,
  Bell,
  User as UserIcon,
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
    logoutUser,
    globalSearchQuery,
    setGlobalSearchQuery,
    notifications,
    dismissNotification,
    activeTab,
    setActiveTab,
    checkouts
  } = useArchive();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const overdueCount = checkouts.filter(c => c.status === 'OVERDUE').length;

  // Dismiss dropdowns on outside click or Escape.
  useEffect(() => {
    if (!showUserDropdown && !showNotifDropdown) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showNotifDropdown && notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifDropdown(false);
      }
      if (showUserDropdown && userRef.current && !userRef.current.contains(target)) {
        setShowUserDropdown(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifDropdown(false);
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showUserDropdown, showNotifDropdown]);

  // Typing a query takes the user to the document archive once — not on
  // every keystroke, which would yank them out of an open detail view.
  const handleSearchChange = (value: string) => {
    setGlobalSearchQuery(value);
    if (value.trim().length > 0 && activeTab !== 'documents') {
      setActiveTab('documents');
      if (onSelectTab) onSelectTab('documents');
    }
  };

  const goToCheckouts = () => {
    setShowNotifDropdown(false);
    setActiveTab('checkouts');
    if (onSelectTab) onSelectTab('checkouts');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">

        {/* Mobile Hamburger & Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label="Go to dashboard"
            className="flex items-center gap-2 sm:gap-3 text-left select-none min-w-0"
            onClick={() => {
              setActiveTab('dashboard');
              if (onSelectTab) onSelectTab('dashboard');
            }}
          >
            <div className="p-1.5 sm:p-2 bg-teal-600 text-white rounded-lg flex-shrink-0">
              <Archive className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base sm:text-lg tracking-tight truncate">
                  ArchiveHub
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 rounded border border-teal-200/60 dark:border-teal-800 hidden xs:inline-block">
                  PDAMS
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 hidden lg:block">
                Physical & Digital Archive Management System
              </span>
            </div>
          </button>
        </div>

        {/* Global Search Input on Desktop (Hidden on mobile) */}
        <div className="flex-1 max-w-md relative hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search archive"
              value={globalSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search doc #, title, reference, location…"
              className="input pl-10 pr-9 bg-zinc-50 dark:bg-zinc-800/60 border-transparent focus:bg-white dark:focus:bg-zinc-900"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

          {/* Mobile Search Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            aria-label="Toggle search bar"
            aria-expanded={showMobileSearch}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors md:hidden"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Primary global action: scan */}
          <button
            type="button"
            onClick={onOpenScanner}
            className="btn-primary btn-sm"
            title="Scan a location tag or document QR code"
            aria-label="Scan tag or QR code"
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* Secondary global action: batch relocate */}
          {onOpenBatchRelocate && (
            <button
              type="button"
              onClick={onOpenBatchRelocate}
              className="btn-secondary btn-sm"
              title="Batch relocate documents by scanning QR codes"
              aria-label="Batch relocate documents"
            >
              <Truck className="w-4 h-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
              <span className="hidden lg:inline">Batch Relocate</span>
            </button>
          )}

          {/* Notifications Center */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotifDropdown(!showNotifDropdown);
                setShowUserDropdown(false);
              }}
              aria-label={overdueCount > 0 ? `Notifications, ${overdueCount} overdue loans` : 'Notifications'}
              aria-expanded={showNotifDropdown}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors relative"
              title="System alerts & notifications"
            >
              <Bell className="w-5 h-5" />
              {(notifications.length > 0 || overdueCount > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900" aria-hidden="true" />
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-80 card shadow-lg p-3 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="section-title">Notifications</span>
                  <span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {notifications.length}
                  </span>
                </div>

                {overdueCount > 0 && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1">
                      <span className="font-semibold block">Overdue loans</span>
                      <span>{overdueCount} document(s) past their due return date.</span>
                      <button
                        type="button"
                        onClick={goToCheckouts}
                        className="block mt-1 font-semibold text-rose-700 dark:text-rose-300 underline underline-offset-2 hover:text-rose-900 dark:hover:text-rose-100"
                      >
                        Review at Circulation Desk →
                      </button>
                    </div>
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-3 text-center">No new notifications</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="pt-2 flex items-start justify-between gap-2 text-xs">
                        <div className="flex items-start gap-2">
                          {n.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" aria-hidden="true" />}
                          {n.type === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" aria-hidden="true" />}
                          {n.type === 'info' && <Info className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" aria-hidden="true" />}
                          {n.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" aria-hidden="true" />}
                          <div>
                            <p className="text-zinc-800 dark:text-zinc-200">{n.message}</p>
                            <span className="text-[10px] text-zinc-400 font-mono">{n.timestamp}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => dismissNotification(n.id)}
                          aria-label={`Dismiss notification: ${n.message}`}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
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

          {/* User menu (single home for persona switching) */}
          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowNotifDropdown(false);
              }}
              aria-label="User menu"
              aria-expanded={showUserDropdown}
              className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2 sm:pr-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700 min-h-[38px]"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <span className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-tight truncate max-w-[120px]">
                  {currentUser.fullName}
                </span>
                <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 leading-none">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-72 card shadow-lg p-2 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="block font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">{currentUser.fullName}</span>
                    <span className="block text-[10px] text-zinc-500 truncate">{currentUser.email}</span>
                  </div>
                  <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 uppercase flex-shrink-0">
                    {currentUser.role}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileModal(true);
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                    My Profile & Account
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      if (onSelectTab) onSelectTab('settings');
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                    System & Account Settings
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      logoutUser();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Expandable Mobile Search Bar */}
      {showMobileSearch && (
        <div className="px-3 pb-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 md:hidden bg-white/95 dark:bg-zinc-900/95 animate-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              autoFocus
              aria-label="Search archive"
              value={globalSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search doc #, title, ref, cabinet, box…"
              className="input pl-9 pr-9"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </header>
  );
};