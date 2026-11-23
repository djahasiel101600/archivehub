import React, { useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { ClipboardList, Search } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';

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

      <PageHeader
        icon={ClipboardList}
        title="Audit log"
        description="Review archive activity by user, action, record, and time."
      />

      {/* Filter */}
      <div className="toolbar">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          aria-label="Filter audit log"
          placeholder="Search by action, user, record, or details"
          className="input flex-1"
        />
        {filterQuery && (
          <button type="button" onClick={() => setFilterQuery('')} className="btn btn-ghost btn-sm">
            Clear
          </button>
        )}
      </div>

      {/* Audit List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="th">Timestamp</th>
                <th className="th">Action</th>
                <th className="th">User</th>
                <th className="th">Target record</th>
                <th className="th">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      {filterQuery.trim() ? 'No audit entries match your search.' : 'No audit activity has been recorded yet.'}
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                  <td className="td font-mono text-xs text-zinc-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="td whitespace-nowrap">
                    <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 font-mono uppercase">
                      {log.action}
                    </span>
                  </td>
                  <td className="td whitespace-nowrap">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{log.userName}</span>
                    <span className="block text-[11px] text-zinc-400">{log.userRole}</span>
                  </td>
                  <td className="td font-medium text-zinc-800 dark:text-zinc-200">
                    {log.entityName}
                  </td>
                  <td className="td text-zinc-600 dark:text-zinc-300 max-w-md">
                    <p>{log.details}</p>
                    {log.afterValue && (
                      <p className="text-[11px] font-mono text-teal-600 dark:text-teal-400 mt-0.5">
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