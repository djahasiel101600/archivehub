import React, { useState, useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { 
  Settings, 
  Building2, 
  FileText, 
  RotateCcw, 
  ShieldCheck, 
  Users, 
  Database, 
  ToggleLeft, 
  ToggleRight, 
  UserPlus, 
  Trash2, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Mail,
  User as UserIcon,
  SlidersHorizontal,
  Plus,
  Edit,
  X,
  Layers,
  Clock,
  Check,
  XCircle,
  UserCheck,
  UserX
} from 'lucide-react';
import { RoleCode, Department } from '../types';
import { ConfirmModal } from '../components/common/ConfirmModal';

export const SettingsPage: React.FC = () => {
  const { 
    departments, 
    addDepartment,
    updateDepartment,
    deleteDepartment,
    documentTypes, 
    addDocumentType,
    updateDocumentType,
    deleteDocumentType,
    reusableCustomFields,
    addReusableCustomField,
    updateReusableCustomField,
    deleteReusableCustomField,
    registeredUsers,
    availableUsers,
    pendingUsers,
    pendingUsersCount,
    approveUser,
    rejectUser,
    signupUser,
    deleteUser,
    currentUser,
    documents,
    locations,
    checkouts,
    movements,
    auditLogs,
    addNotification,
    dbHealth,
    refreshDbHealth,
    reseedDatabase,
    exportAllData,
    importAllData
  } = useArchive();

  // Create Document Type State
  const [showCreateDocTypeModal, setShowCreateDocTypeModal] = useState(false);
  const [docTypeToDelete, setDocTypeToDelete] = useState<{ id: string; name: string } | null>(null);

  // Department Management State
  const [deptModalMode, setDeptModalMode] = useState<'create' | 'edit' | null>(null);
  const [deptEditing, setDeptEditing] = useState<Department | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);

  const [newDtName, setNewDtName] = useState('');
  const [newDtCode, setNewDtCode] = useState('');
  const [newDtDescription, setNewDtDescription] = useState('');
  const [newDtRetentionYears, setNewDtRetentionYears] = useState(5);
  const [newDtDeptId, setNewDtDeptId] = useState<string>('ALL');

  const handleCreateDocTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDtName.trim() || !newDtCode.trim()) return;

    const deptObj = departments.find(d => d.id === newDtDeptId);

    addDocumentType({
      name: newDtName.trim(),
      code: newDtCode.trim().toUpperCase(),
      description: newDtDescription.trim() || 'Custom Document Classification Type',
      retentionYears: Number(newDtRetentionYears) || 5,
      departmentId: newDtDeptId === 'ALL' ? undefined : newDtDeptId,
      departmentName: newDtDeptId === 'ALL' ? 'All Departments (Universal)' : (deptObj?.name || 'General Department'),
      customFields: []
    });

    setNewDtName('');
    setNewDtCode('');
    setNewDtDescription('');
    setNewDtRetentionYears(5);
    setNewDtDeptId('ALL');
    setShowCreateDocTypeModal(false);
  };

  // Reusable Custom Fields Library State
  const [showReusableFieldModal, setShowReusableFieldModal] = useState(false);
  const [editingReusableFieldId, setEditingReusableFieldId] = useState<string | null>(null);
  const [rcfName, setRcfName] = useState('');
  const [rcfLabel, setRcfLabel] = useState('');
  const [rcfType, setRcfType] = useState<'text' | 'number' | 'date' | 'select'>('select');
  const [rcfOptions, setRcfOptions] = useState('');
  const [rcfPlaceholder, setRcfPlaceholder] = useState('');
  const [rcfDescription, setRcfDescription] = useState('');
  const [rcfDeptId, setRcfDeptId] = useState('ALL');
  const [rcfToDelete, setRcfToDelete] = useState<{ id: string; name: string } | null>(null);

  const openCreateReusableFieldModal = () => {
    setEditingReusableFieldId(null);
    setRcfName('');
    setRcfLabel('');
    setRcfType('select');
    setRcfOptions('');
    setRcfPlaceholder('');
    setRcfDescription('');
    setRcfDeptId('ALL');
    setShowReusableFieldModal(true);
  };

  const openEditReusableFieldModal = (fieldId: string) => {
    const field = reusableCustomFields.find(f => f.id === fieldId);
    if (!field) return;
    setEditingReusableFieldId(field.id);
    setRcfName(field.name);
    setRcfLabel(field.label);
    setRcfType(field.type);
    setRcfOptions(field.options?.join(', ') || '');
    setRcfPlaceholder(field.placeholder || '');
    setRcfDescription(field.description || '');
    setRcfDeptId(field.departmentId || 'ALL');
    setShowReusableFieldModal(true);
  };

  const handleSaveReusableField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rcfName.trim() || !rcfLabel.trim()) return;

    const parsedOptions = rcfOptions
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    const payload = {
      name: rcfName.trim(),
      label: rcfLabel.trim(),
      type: rcfType,
      options: rcfType === 'select' ? parsedOptions : undefined,
      placeholder: rcfPlaceholder.trim() || undefined,
      description: rcfDescription.trim() || undefined,
      departmentId: rcfDeptId === 'ALL' ? undefined : rcfDeptId,
      isGlobal: rcfDeptId === 'ALL'
    };

    if (editingReusableFieldId) {
      updateReusableCustomField(editingReusableFieldId, payload);
    } else {
      addReusableCustomField(payload);
    }

    setShowReusableFieldModal(false);
  };

  // Custom Field Schema Management State for specific Document Type
  const [activeDocTypeForFields, setActiveDocTypeForFields] = useState<string | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldModalTab, setFieldModalTab] = useState<'reusable' | 'custom'>('reusable');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'select'>('select');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldRequired, setFieldRequired] = useState(true);
  const [saveAlsoAsReusable, setSaveAlsoAsReusable] = useState(false);

  // Attach a reusable field to document type
  const handleAttachReusableField = (rcfId: string) => {
    if (!activeDocTypeForFields) return;
    const targetDocType = documentTypes.find(dt => dt.id === activeDocTypeForFields);
    const rcf = reusableCustomFields.find(f => f.id === rcfId);
    if (!targetDocType || !rcf) return;

    // Prevent duplicate field names
    const existing = targetDocType.customFields || [];
    if (existing.some(f => f.name.toLowerCase() === rcf.name.toLowerCase())) {
      addNotification('warning', `Field "${rcf.name}" is already added to ${targetDocType.name}.`);
      return;
    }

    const newFieldDef = {
      id: `cf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: rcf.name,
      label: rcf.label,
      type: rcf.type,
      options: rcf.options ? [...rcf.options] : undefined,
      placeholder: rcf.placeholder,
      required: true
    };

    updateDocumentType(targetDocType.id, {
      customFields: [...existing, newFieldDef]
    });

    addNotification('success', `Attached "${rcf.label}" to ${targetDocType.name}.`);
    setShowFieldModal(false);
  };

  const handleAddCustomFieldToDocType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDocTypeForFields || !fieldLabel.trim()) return;

    const targetDocType = documentTypes.find(dt => dt.id === activeDocTypeForFields);
    if (!targetDocType) return;

    const nameKey = fieldLabel.trim();
    const parsedOptions = fieldOptions
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    const newFieldDef = {
      id: `cf-${Date.now()}`,
      name: nameKey,
      label: nameKey,
      type: fieldType,
      options: fieldType === 'select' ? parsedOptions : undefined,
      required: fieldRequired
    };

    const existingFields = targetDocType.customFields || [];
    updateDocumentType(targetDocType.id, {
      customFields: [...existingFields, newFieldDef]
    });

    // Optionally also save into Reusable Library
    if (saveAlsoAsReusable) {
      addReusableCustomField({
        name: nameKey,
        label: nameKey,
        type: fieldType,
        options: fieldType === 'select' ? parsedOptions : undefined,
        description: `Created from ${targetDocType.name}`,
        isGlobal: true
      });
    }

    addNotification('success', `Added custom field "${nameKey}" to ${targetDocType.name}.`);
    setFieldLabel('');
    setFieldOptions('');
    setSaveAlsoAsReusable(false);
    setShowFieldModal(false);
  };

  const handleRemoveCustomFieldFromDocType = (docTypeId: string, fieldId: string) => {
    const targetDocType = documentTypes.find(dt => dt.id === docTypeId);
    if (!targetDocType) return;

    const updatedFields = (targetDocType.customFields || []).filter(f => f.id !== fieldId);
    updateDocumentType(docTypeId, { customFields: updatedFields });
    addNotification('info', `Removed custom field definition.`);
  };

  // Create User Modal/Form state inside Settings
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDeptId, setNewUserDeptId] = useState('dept-01');
  const [newUserRole, setNewUserRole] = useState<RoleCode>('DEPT_USER');
  const [newUserTitle, setNewUserTitle] = useState('');
  const [newUserAutoApprove, setNewUserAutoApprove] = useState(true);
  const [userFilterTab, setUserFilterTab] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [formError, setFormError] = useState('');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newUserName.trim() || !newUserEmail.trim()) {
      setFormError('Please fill in required fields (Name & Email).');
      return;
    }

    const dept = departments.find(d => d.id === newUserDeptId);

    const res = await signupUser({
      fullName: newUserName.trim(),
      email: newUserEmail.trim(),
      password: newUserPassword,
      role: newUserRole,
      departmentId: newUserDeptId,
      departmentName: dept ? dept.name : 'General Staff',
      title: newUserTitle.trim() || 'Archive Staff'
    });

    if (!res.success) {
      setFormError(res.message || 'Error creating user.');
    } else {
      if (newUserAutoApprove && res.user) {
        await approveUser(res.user.id);
        addNotification('success', `User account ${res.user.fullName} created and approved.`);
      } else {
        addNotification('info', `User account registered in pending approval queue.`);
      }
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserTitle('');
    }
  };

  // Data Backup & Restore State
  const importFileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ payload: any; fileName: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportFullBackup = async () => {
    setIsExporting(true);
    const res = await exportAllData();
    setIsExporting(false);
    if (res.success && res.blob) {
      const url = URL.createObjectURL(res.blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `archivehub-backup-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      addNotification('success', 'Full database backup downloaded.');
    }
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (payload?.format !== 'archivehub-export' || typeof payload.tables !== 'object' || payload.tables === null) {
        addNotification('error', 'Invalid backup file: expected an ArchiveHub export JSON produced by "Export Full Backup".');
        return;
      }
      setPendingImport({ payload, fileName: file.name });
    } catch {
      addNotification('error', 'Could not read the selected file: it is not valid JSON.');
    }
  };

  const confirmImportRestore = async () => {
    if (!pendingImport) return;
    setIsImporting(true);
    const res = await importAllData(pendingImport.payload);
    setIsImporting(false);
    setPendingImport(null);
    if (res.success) {
      const counts: Record<string, number> = res.counts || {};
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      addNotification('success', `Backup restored successfully: ${total} records imported across all tables.`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          ArchiveHub System Settings & Operational Parameters
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure physical storage structures, document classification schemas, user accounts, and organizational standards.
        </p>
      </div>

      {/* POSTGRESQL DATABASE ENGINE INTEGRATION & STATUS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                PostgreSQL Relational Database Engine Status
              </h3>
              <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                dbHealth?.connected 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' 
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
              }`}>
                {dbHealth?.connected ? '● PostgreSQL Connection Active' : '○ Standby / Fallback Storage'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              ArchiveHub is configured to run on PostgreSQL standard ORM (Drizzle ORM). Driven by environment variable <code className="font-mono text-emerald-600 dark:text-emerald-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">DATABASE_URL</code>, seamlessly portable between Supabase (Development) and Ubuntu Docker Container (Production).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshDbHealth}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
              Check Health
            </button>

            <button
              type="button"
              onClick={reseedDatabase}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              Run Migration & Seed
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Database Provider</span>
            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dbHealth?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              Provider-Agnostic PostgreSQL
            </div>
            <span className="text-[11px] text-slate-500 block">
              Supabase / Self-Hosted Docker PG
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">ORM & Driver</span>
            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
              Drizzle ORM + pg (Pool)
            </div>
            <span className="text-[11px] text-slate-500 block">
              Typed Relational Queries & Transactions
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Connection Health</span>
            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs truncate">
              {dbHealth?.message || 'Awaiting status query...'}
            </div>
            <span className="text-[11px] text-slate-500 block">
              {dbHealth?.timestamp ? `Last checked: ${new Date(dbHealth.timestamp).toLocaleTimeString()}` : 'Click "Check Health" to test'}
            </span>
          </div>
        </div>

        {/* Supabase Connection Setup Instructions */}
        {!dbHealth?.connected && (
          <div className="mt-3 p-4 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200/90 dark:border-amber-900/60 text-xs space-y-2">
            <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              How to Connect Your Supabase PostgreSQL Database:
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-amber-800 dark:text-amber-300 font-medium leading-relaxed pl-1">
              <li>
                In your Supabase Dashboard, go to <strong>Project Settings &rarr; Database &rarr; Connection String</strong> (URI tab).
              </li>
              <li>
                Copy the connection string (e.g., <code className="bg-amber-100 dark:bg-amber-900/80 px-1 py-0.5 rounded font-mono text-[11px]">postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require</code>).
              </li>
              <li>
                In your project workspace, create a <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.env</code> file (or copy <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.env.example</code> to <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.env</code>) and paste your string:
                <div className="mt-1 font-mono text-[11px] bg-slate-900 text-emerald-400 p-2.5 rounded-lg overflow-x-auto selection:bg-emerald-800">
                  DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"
                </div>
              </li>
              <li>
                Click <span className="font-bold underline">Check Health</span> above. When the status turns green (<span className="text-emerald-700 dark:text-emerald-400 font-bold">● PostgreSQL Connection Active</span>), click <span className="font-bold underline">Run Migration & Seed</span> to generate all 10 relational tables automatically!
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* DATABASE METRICS & BACKUP EXPORT */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Database Records & Backup Management
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Export a full backup of every table (documents, locations, bundles, users, checkouts, movements, audit logs, and settings) or restore the database from a previously exported backup file.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFileSelected}
            />
            <button
              type="button"
              onClick={handleExportFullBackup}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors border border-indigo-200/80 dark:border-indigo-800 shadow-sm"
            >
              <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {isExporting ? 'Preparing Export...' : 'Export Full Backup'}
            </button>
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl transition-colors border border-amber-200/80 dark:border-amber-800 shadow-sm"
            >
              <Upload className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {isImporting ? 'Restoring...' : 'Import / Restore Backup'}
            </button>
          </div>
        </div>

        {/* Dataset Details & Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Catalog Records</span>
            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
              {documents.length} Documents
            </div>
            <span className="text-[11px] text-slate-500 block">
              Registered physical and digital archive items
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Storage Hierarchy</span>
            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
              {locations.length} Physical Nodes
            </div>
            <span className="text-[11px] text-slate-500 block">
              Buildings, Floors, Rooms, Cabinets, Shelves, and Boxes
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Circulation Ledger</span>
            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
              {checkouts.length} Borrow Requests
            </div>
            <span className="text-[11px] text-slate-500 block">
              Active checkouts, returns, and circulation history
            </span>
          </div>
        </div>
      </div>

      {/* USER ACCOUNT CREATION & MANAGEMENT WITH ADMIN APPROVAL WORKFLOW */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                User Creation & Registered Accounts ({availableUsers.length})
              </h3>
              {pendingUsers.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-[10px] rounded-full border border-amber-300 dark:border-amber-700 animate-pulse flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {pendingUsers.length} Pending Approval
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review new registration requests, approve/reject user access, and manage operational permissions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddUserModal(true)}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            Register New User
          </button>
        </div>

        {/* PENDING APPROVAL NOTIFICATION / ACTION BANNER */}
        {pendingUsers.length > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/30 dark:border-amber-800/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Pending Account Registration Queue ({pendingUsers.length})</span>
              </div>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                Admin action required before users can sign in
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingUsers.map(user => (
                <div 
                  key={user.id} 
                  className="p-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-xl shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                          <span>{user.fullName}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                            {user.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">
                          {user.email}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {user.departmentName} &bull; {user.title || 'Applicant'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => rejectUser(user.id)}
                      className="px-2.5 py-1 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800 font-semibold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => approveUser(user.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors shadow-xs flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve Account
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setUserFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              userFilterTab === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Accounts ({availableUsers.length})
          </button>

          <button
            type="button"
            onClick={() => setUserFilterTab('APPROVED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              userFilterTab === 'APPROVED'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved ({availableUsers.filter(u => (u.approvalStatus || 'APPROVED') === 'APPROVED').length})
          </button>

          <button
            type="button"
            onClick={() => setUserFilterTab('PENDING')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              userFilterTab === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Approval ({availableUsers.filter(u => u.approvalStatus === 'PENDING_APPROVAL').length})
          </button>

          <button
            type="button"
            onClick={() => setUserFilterTab('REJECTED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              userFilterTab === 'REJECTED'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Rejected ({availableUsers.filter(u => u.approvalStatus === 'REJECTED').length})
          </button>
        </div>

        {/* User List Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-mono tracking-wider">
              <tr>
                <th className="p-3">User & Title</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Role Code</th>
                <th className="p-3">Department</th>
                <th className="p-3">Approval Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {availableUsers
                .filter(user => {
                  const status = user.approvalStatus || 'APPROVED';
                  if (userFilterTab === 'APPROVED') return status === 'APPROVED';
                  if (userFilterTab === 'PENDING') return status === 'PENDING_APPROVAL';
                  if (userFilterTab === 'REJECTED') return status === 'REJECTED';
                  return true;
                })
                .map(user => {
                  const status = user.approvalStatus || 'APPROVED';
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center flex-shrink-0 ${
                            status === 'PENDING_APPROVAL' 
                              ? 'bg-amber-600' 
                              : status === 'REJECTED' 
                              ? 'bg-rose-600' 
                              : 'bg-indigo-600'
                          }`}>
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span>{user.fullName}</span>
                              {user.id === currentUser.id && (
                                <span className="text-[9px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold px-1.5 py-0.2 rounded">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 block font-normal">{user.title || 'Staff User'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {user.email}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {user.departmentName}
                      </td>
                      <td className="p-3">
                        {status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Approved
                          </span>
                        )}
                        {status === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-pulse" />
                            Pending Review
                          </span>
                        )}
                        {status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                onClick={() => approveUser(user.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                                title="Approve this account"
                              >
                                <Check className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectUser(user.id)}
                                className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                                title="Reject this account"
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                            </>
                          )}

                          {status === 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() => approveUser(user.id)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                              title="Re-approve this account"
                            >
                              <Check className="w-3 h-3" />
                              Re-Approve
                            </button>
                          )}

                          {status === 'APPROVED' && user.id !== currentUser.id && user.id.startsWith('usr-reg-') && (
                            <button
                              type="button"
                              onClick={() => rejectUser(user.id)}
                              className="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium text-[10px] rounded-lg transition-colors"
                              title="Revoke Approval / Suspend Account"
                            >
                              Revoke
                            </button>
                          )}

                          {user.id.startsWith('usr-reg-') ? (
                            <button
                              type="button"
                              onClick={() => deleteUser(user.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Remove Registered Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">Demo System User</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Departments Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Configured Organization Departments ({departments.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Create new departments, rename existing ones or retire units that are no longer in use.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setDeptEditing(null); setDeptModalMode('create'); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Department
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {departments.map(dept => (
            <div key={dept.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">[{dept.code}]</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">{dept.documentCount} Registered Records</span>
                  <button
                    type="button"
                    onClick={() => { setDeptEditing(dept); setDeptModalMode('edit'); }}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Edit department"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeptToDelete(dept)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete department"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{dept.name}</h4>
              <p className="text-[11px] text-slate-500">Department Head: {dept.headName}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reusable Custom Fields Library (NEW FEATURE) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Reusable Custom Fields Library ({reusableCustomFields.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Define standard reusable metadata attributes (e.g., Period, Fund Source, Docket No., Contractor) and attach them across Document Types with 1 click.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateReusableFieldModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Reusable Field
          </button>
        </div>

        {reusableCustomFields.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
            <p className="text-xs text-slate-500">No reusable custom fields in library. Create common metadata fields to reuse across document categories.</p>
            <button
              type="button"
              onClick={openCreateReusableFieldModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Field
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {reusableCustomFields.map(field => {
              const dept = departments.find(d => d.id === field.departmentId);
              return (
                <div key={field.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{field.label}</h4>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                        {field.type}
                      </span>
                    </div>
                    {field.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1">{field.description}</p>
                    )}
                    {field.options && field.options.length > 0 && (
                      <div className="text-[10px] text-slate-500 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Options ({field.options.length}): </span>
                        <span className="font-mono text-slate-600 dark:text-slate-400 line-clamp-1">{field.options.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {field.isGlobal || !field.departmentId ? 'Universal (All Depts)' : (dept ? dept.name : 'Department-Specific')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditReusableFieldModal(field.id)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                        title="Edit Field"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRcfToDelete({ id: field.id, name: field.label })}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Types & Retention Standards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Document Types & Custom Classification Schemas
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Define document categories tied to owning departments, retention policies, and dynamic schema fields.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateDocTypeModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Document Type
          </button>
        </div>

        {documentTypes.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
            <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Document Types Defined</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Clean Operational Mode is enabled. Create your first custom Document Type and classification schema to start registering physical archives.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateDocTypeModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Document Type
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {documentTypes.map(dt => (
              <div key={dt.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{dt.name}</h4>
                      <span className="font-mono text-[10px] text-slate-400 font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {dt.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{dt.description}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Building2 className="w-3 h-3 text-indigo-500" />
                        {dt.departmentName || 'All Departments (Universal)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 rounded-md">
                      {dt.retentionYears}y Retention
                    </span>
                    <button
                      type="button"
                      onClick={() => setDocTypeToDelete({ id: dt.id, name: dt.name })}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Delete Document Type"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Configured Custom Fields Badge List */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Custom Fields ({dt.customFields?.length || 0}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDocTypeForFields(dt.id);
                        setFieldModalTab('reusable');
                        setFieldLabel('');
                        setFieldOptions('');
                        setShowFieldModal(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
                    >
                      <Plus className="w-3 h-3" />
                      Add Field
                    </button>
                  </div>

                  {dt.customFields && dt.customFields.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dt.customFields.map(cf => (
                        <span 
                          key={cf.id} 
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium text-[11px] shadow-xs"
                        >
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{cf.label}</span>
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded uppercase">
                            {cf.type}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomFieldFromDocType(dt.id, cf.id)}
                            className="text-slate-400 hover:text-rose-600 ml-0.5"
                            title="Remove Field"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No custom fields defined for this document type.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal to Add Custom Field to Document Type (With Reusable Library Support) */}
      {showFieldModal && activeDocTypeForFields && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                  Add Custom Field to {documentTypes.find(dt => dt.id === activeDocTypeForFields)?.name}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Attach a standard field from your library or define a new one.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
              <button
                type="button"
                onClick={() => setFieldModalTab('reusable')}
                className={`py-3 px-4 font-bold border-b-2 transition-colors ${
                  fieldModalTab === 'reusable'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                From Reusable Library ({reusableCustomFields.length})
              </button>
              <button
                type="button"
                onClick={() => setFieldModalTab('custom')}
                className={`py-3 px-4 font-bold border-b-2 transition-colors ${
                  fieldModalTab === 'custom'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Create New Field
              </button>
            </div>

            {fieldModalTab === 'reusable' ? (
              <div className="p-6 overflow-y-auto flex-1 text-xs space-y-3">
                {reusableCustomFields.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <p className="text-slate-500">No reusable fields available in library.</p>
                    <button
                      type="button"
                      onClick={() => setFieldModalTab('custom')}
                      className="px-3 py-1.5 bg-indigo-600 text-white font-semibold rounded-xl text-xs"
                    >
                      Define a New Field Instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-slate-500 text-[11px]">Click "Attach" on any reusable field below to add it to this Document Type:</p>
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {reusableCustomFields.map(rcf => {
                        const targetDt = documentTypes.find(dt => dt.id === activeDocTypeForFields);
                        const isAlreadyAdded = targetDt?.customFields?.some(cf => cf.name.toLowerCase() === rcf.name.toLowerCase());

                        return (
                          <div 
                            key={rcf.id} 
                            className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">{rcf.label}</span>
                                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                  {rcf.type}
                                </span>
                              </div>
                              {rcf.options && rcf.options.length > 0 && (
                                <p className="text-[10px] text-slate-500 truncate">Options: {rcf.options.join(', ')}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={isAlreadyAdded}
                              onClick={() => handleAttachReusableField(rcf.id)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex-shrink-0 transition-colors ${
                                isAlreadyAdded 
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600' 
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                              }`}
                            >
                              {isAlreadyAdded ? 'Attached' : 'Attach'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleAddCustomFieldToDocType} className="flex-1 flex flex-col min-h-0">
                <div className="p-6 space-y-3 overflow-y-auto flex-1 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Field Label / Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      placeholder="e.g. Period, Fund Source, Office, Category"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Field Input Type
                    </label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
                    >
                      <option value="select">Select Dropdown (Predefined Options)</option>
                      <option value="text">Short Text Input</option>
                      <option value="number">Number Input</option>
                      <option value="date">Date Picker</option>
                    </select>
                  </div>

                  {fieldType === 'select' && (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dropdown Options (Comma-separated) *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={fieldOptions}
                        onChange={(e) => setFieldOptions(e.target.value)}
                        placeholder="e.g. 101 General Fund, 102 Special Education Fund, 151 Trust Fund"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none font-medium"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Separate multiple dropdown choices with commas.</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAlsoAsReusable}
                        onChange={(e) => setSaveAlsoAsReusable(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Also save into Reusable Custom Fields Library for other Document Types
                      </span>
                    </label>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFieldModal(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                  >
                    Save Field
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal to Create/Edit Reusable Custom Field */}
      {showReusableFieldModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                {editingReusableFieldId ? 'Edit Reusable Custom Field' : 'New Reusable Custom Field'}
              </h3>
              <button
                type="button"
                onClick={() => setShowReusableFieldModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReusableField} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Field Label / Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={rcfLabel}
                    onChange={(e) => {
                      setRcfLabel(e.target.value);
                      if (!editingReusableFieldId) {
                        setRcfName(e.target.value);
                      }
                    }}
                    placeholder="e.g. Period / Calendar Year, Fund Source"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Internal Key / Identifier *
                    </label>
                    <input
                      type="text"
                      required
                      value={rcfName}
                      onChange={(e) => setRcfName(e.target.value)}
                      placeholder="e.g. period, fundSource"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Field Type
                    </label>
                    <select
                      value={rcfType}
                      onChange={(e) => setRcfType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
                    >
                      <option value="select">Select Dropdown</option>
                      <option value="text">Text Input</option>
                      <option value="number">Number Input</option>
                      <option value="date">Date Picker</option>
                    </select>
                  </div>
                </div>

                {rcfType === 'select' && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Dropdown Options (Comma-separated) *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={rcfOptions}
                      onChange={(e) => setRcfOptions(e.target.value)}
                      placeholder="e.g. Q1 2024, Q2 2024, Q3 2024, Q4 2024"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department Scope
                  </label>
                  <select
                    value={rcfDeptId}
                    onChange={(e) => setRcfDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
                  >
                    <option value="ALL">Universal (Available to All Departments)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} only</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description / Archival Context (Optional)
                  </label>
                  <input
                    type="text"
                    value={rcfDescription}
                    onChange={(e) => setRcfDescription(e.target.value)}
                    placeholder="e.g. Used for accounting and financial ledgers"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReusableFieldModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  {editingReusableFieldId ? 'Update Field' : 'Save to Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Reusable Field Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(rcfToDelete)}
        onClose={() => setRcfToDelete(null)}
        onConfirm={() => {
          if (rcfToDelete) {
            deleteReusableCustomField(rcfToDelete.id);
            setRcfToDelete(null);
          }
        }}
        title="Delete Reusable Custom Field"
        message={`Are you sure you want to remove "${rcfToDelete?.name || ''}" from the Reusable Fields Library? Existing document types already using this field will retain their field definition.`}
        confirmText="Delete from Library"
        variant="danger"
      />

      {/* Import / Restore Backup Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingImport)}
        onClose={() => { if (!isImporting) setPendingImport(null); }}
        onConfirm={confirmImportRestore}
        title="Restore Database from Backup"
        message={`You are about to import "${pendingImport?.fileName || ''}". This will completely REPLACE all current data (documents, locations, bundles, users, checkouts, movements, audit logs, and settings) with the contents of the backup file. This action cannot be undone. Do you want to continue?`}
        confirmText={isImporting ? 'Restoring...' : 'Yes, Restore Backup'}
        variant="danger"
      />

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Register New User Account
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-200 rounded-xl text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. David Miller"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. d.miller@archivehub.org"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={newUserDeptId}
                    onChange={(e) => setNewUserDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={newUserTitle}
                    onChange={(e) => setNewUserTitle(e.target.value)}
                    placeholder="e.g. Archivist"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  System Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as RoleCode)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="DEPT_USER">Department User</option>
                  <option value="RECORDS_OFFICER">Records Officer</option>
                  <option value="RECORDS_ADMIN">Records Administrator</option>
                  <option value="ADMIN">System Administrator</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </div>

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUserAutoApprove}
                    onChange={(e) => setNewUserAutoApprove(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      Auto-approve account immediately
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      If checked, user can sign in immediately without waiting in the approval queue.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Document Type Modal */}
      {showCreateDocTypeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Create New Document Classification Type
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateDocTypeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDocTypeSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-3 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Document Type Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDtName}
                    onChange={(e) => setNewDtName(e.target.value)}
                    placeholder="e.g. Environmental Impact Assessment, Executive Order"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Owning Department Association *
                  </label>
                  <select
                    value={newDtDeptId}
                    onChange={(e) => setNewDtDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
                  >
                    <option value="ALL">Universal (All Departments)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">When adding physical documents, this document type will only show up when its tied department is selected.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Classification Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDtCode}
                      onChange={(e) => setNewDtCode(e.target.value)}
                      placeholder="e.g. EIA, EO, CWR"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono uppercase font-bold text-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Retention Period (Years) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={newDtRetentionYears}
                      onChange={(e) => setNewDtRetentionYears(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description / Archival Purpose
                  </label>
                  <textarea
                    rows={3}
                    value={newDtDescription}
                    onChange={(e) => setNewDtDescription(e.target.value)}
                    placeholder="Describe the scope, compliance rules, or archival category..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none font-medium"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateDocTypeModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  Create Document Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Document Type Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(docTypeToDelete)}
        onClose={() => setDocTypeToDelete(null)}
        onConfirm={() => {
          if (docTypeToDelete) {
            deleteDocumentType(docTypeToDelete.id);
            setDocTypeToDelete(null);
          }
        }}
        title="Delete Document Type"
        message={`Are you sure you want to delete Document Type "${docTypeToDelete?.name || ''}"? Any custom classification field schemas attached to it will also be removed.`}
        confirmText="Delete Document Type"
        variant="danger"
      />

      {/* Department Create/Edit Modal */}
      {deptModalMode && (
        <DepartmentModal
          mode={deptModalMode}
          department={deptEditing || undefined}
          onClose={() => { setDeptModalMode(null); setDeptEditing(null); }}
        />
      )}

      {/* Delete Department Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deptToDelete)}
        onClose={() => setDeptToDelete(null)}
        onConfirm={async () => {
          if (deptToDelete) {
            await deleteDepartment(deptToDelete.id);
            setDeptToDelete(null);
          }
        }}
        title="Delete Organization Department"
        message={`Are you sure you want to delete "${deptToDelete?.name || ''}" [${deptToDelete?.code || ''}]? Deletion is blocked while documents, bundles or user accounts are still assigned to this department.`}
        confirmText="Delete Department"
        variant="danger"
      />

    </div>
  );
};

interface DepartmentModalProps {
  mode: 'create' | 'edit';
  department?: Department;
  onClose: () => void;
}

const DepartmentModal: React.FC<DepartmentModalProps> = ({ mode, department, onClose }) => {
  const { addDepartment, updateDepartment } = useArchive();
  const [code, setCode] = useState(department?.code || '');
  const [name, setName] = useState(department?.name || '');
  const [headName, setHeadName] = useState(department?.headName || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !headName.trim() || saving) return;
    setSaving(true);
    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      headName: headName.trim()
    };
    if (mode === 'create') {
      const created = await addDepartment(payload);
      setSaving(false);
      if (created) onClose();
    } else if (department) {
      await updateDepartment(department.id, payload);
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            {mode === 'create' ? 'Add New Department' : `Edit Department — ${department?.code}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-6 space-y-3 overflow-y-auto flex-1 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department Code *
              </label>
              <input
                type="text"
                required
                maxLength={20}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. HRD, FIN, OPS"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono uppercase font-bold text-indigo-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Human Resource Development"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
              />
              {mode === 'edit' && (
                <p className="text-[10px] text-slate-400 mt-1">Renaming a department also updates the stored department name on its documents, bundles, document types and user accounts.</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department Head *
              </label>
              <input
                type="text"
                required
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : (mode === 'create' ? 'Create Department' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
