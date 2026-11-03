import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, icon: Icon, actions }) => (
  <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="flex items-start gap-3 min-w-0">
      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center">{actions}</div>}
  </header>
);
