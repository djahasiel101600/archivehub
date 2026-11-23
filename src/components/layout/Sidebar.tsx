import React, { useEffect, useState } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  LayoutDashboard,
  Network,
  FileText,
  ArrowRightLeft,
  ShieldCheck,
  ClipboardList,
  Settings,
  RotateCcw,
  X,
  Archive,
  LogOut,
  Layers,
  type LucideIcon
} from 'lucide-react';

interface SidebarProps {
  onSelectTab?: (tabId: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  badgeClasses?: string;
  badgeTitle?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const {
    activeTab,
    setActiveTab,
    checkouts,
    reseedDatabase,
    currentUser,
    pendingUsersCount,
    logoutUser
  } = useArchive();

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseMobile) onCloseMobile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileOpen, onCloseMobile]);

  const overdueDocs = checkouts.filter(c => c.status === 'OVERDUE').length;
  const pendingRequests = checkouts.filter(c => c.status === 'REQUESTED').length;

  // Grouped by operational domain so related modules sit together.
  const navGroups: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard }
      ]
    },
    {
      label: 'Records',
      items: [
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'bundles', label: 'Bundles', icon: Layers },
        { id: 'locations', label: 'Locations', icon: Network }
      ]
    },
    {
      label: 'Circulation',
      items: [
        {
          id: 'checkouts',
          label: 'Circulation Desk',
          icon: ArrowRightLeft,
          badge: overdueDocs > 0 ? String(overdueDocs) : pendingRequests > 0 ? String(pendingRequests) : undefined,
          badgeClasses: overdueDocs > 0
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
            : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400',
          badgeTitle: overdueDocs > 0 ? `${overdueDocs} overdue loan(s)` : `${pendingRequests} request(s) pending approval`
        }
      ]
    },
    {
      label: 'Compliance',
      items: [
        { id: 'retention', label: 'Retention', icon: ShieldCheck },
        { id: 'audit', label: 'Audit Log', icon: ClipboardList }
      ]
    },
    {
      label: 'Administration',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          badge: (currentUser.role === 'ADMIN' && pendingUsersCount > 0) ? String(pendingUsersCount) : undefined,
          badgeClasses: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
          badgeTitle: `${pendingUsersCount} user account(s) awaiting approval`
        }
      ]
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
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">

      {/* Mobile Drawer Header with Close Button */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-teal-600 text-white rounded-lg">
            <Archive className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">ArchiveHub</span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="p-3 flex-1 space-y-4 overflow-y-auto" aria-label="Main navigation">
        {navGroups.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.label && (
              <div className="px-3 pt-1 pb-1 text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors min-h-[40px] ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-400 dark:text-zinc-500'}`} aria-hidden="true" />
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`chip ${item.badgeClasses || 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                      title={item.badgeTitle}
                      aria-label={item.badgeTitle}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Active user & session actions (persona switching lives in the header) */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0">
            {currentUser?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
              {currentUser?.fullName || 'User'}
            </span>
            <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight truncate">
              {currentUser?.role} &bull; {currentUser?.departmentName || 'Staff'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              logoutUser();
              if (onCloseMobile) onCloseMobile();
            }}
            className="btn-secondary btn-sm flex-1"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Sign Out
          </button>
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            aria-label="Reset demo data"
            title="Reset demo dataset to the initial seed state"
            className="btn-ghost btn-sm btn-icon"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Visible >= md) */}
      <aside className="hidden md:flex w-60 bg-white dark:bg-zinc-900 flex-col flex-shrink-0 min-h-[calc(100vh-4rem)] border-r border-zinc-200 dark:border-zinc-800">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer (Visible < md when opened) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-4/5 max-w-xs h-full z-10 shadow-2xl animate-in slide-in-from-left duration-250 flex flex-col">
            {sidebarContent}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          reseedDatabase();
          if (onCloseMobile) onCloseMobile();
        }}
        title="Reset demo data?"
        message="This re-seeds the database with the initial demo dataset. All current records, checkouts and audit entries will be replaced. This cannot be undone."
        confirmText="Reset Data"
        variant="danger"
      />
    </>
  );
};