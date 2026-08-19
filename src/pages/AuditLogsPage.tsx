import React, { useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { ClipboardList, Search, User as UserIcon, Shield, Clock } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { auditLogs } = useArchive();
  const [filterQuery, setFilterQuery] = useState('');

  const filteredLogs = auditLogs.filter(log => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.userName.toLowerCase().includes(q) ||
      log.entityName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Immutable Archive Audit Ledger
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Complete regulatory transaction trail recording who moved, checked out, updated, or registered every physical document
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter audit entries by action, user, document, or details..."
          className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Audit List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-mono font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Action Event</th>
                <th className="px-4 py-3.5">User Persona</th>
                <th className="px-4 py-3.5">Target Entity</th>
                <th className="px-4 py-3.5">Transaction Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{log.userName}</span>
                    <span className="block text-[10px] text-slate-400 font-mono">[{log.userRole}]</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                    {log.entityName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-md">
                    <p>{log.details}</p>
                    {log.afterValue && (
                      <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {log.afterValue}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
