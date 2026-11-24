import React, { useState, useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import {
  Settings,
  Building2,
  RotateCcw,
  Users,
  Database,
  UserPlus,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Lock,
  SlidersHorizontal,
  Plus,
  Edit,
  X,
  Layers,
  Clock,
  Check,
  XCircle,
  ChevronDown,
  ShieldAlert
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RoleCode, Department, DocumentTypeInfo, CustomFieldDefinition, CustomFieldType } from '../types';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PageHeader } from '../components/common/PageHeader';

/* Collapsible settings group: header row toggles the body; a badge keeps
   key counts/status visible even while the section is collapsed. */
interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ icon: Icon, title, description, badge, open, onToggle, tone = 'default', children }) => (
  <section className={`card overflow-hidden ${tone === 'danger' ? 'border-rose-200 dark:border-rose-900/60' : ''}`}>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center gap-3 px-4 sm:px-6 py-4 text-left hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
    >
      <span className={`p-2 rounded-lg shrink-0 ${tone === 'danger' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400'}`}>
        <Icon className="w-4 h-4" aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="section-title flex items-center gap-2 flex-wrap">
          {title}
          {badge}
        </span>
        <span className="meta block mt-0.5">{description}</span>
      </span>
      <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    {open && (
      <div className="px-4 sm:px-6 pb-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
        {children}
      </div>
    )}
  </section>
);

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
    createUser,
    refreshEntities,
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
    exportCsv,
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

  // Edit Document Type State (existing custom field types are locked)
  const [editingDocType, setEditingDocType] = useState<DocumentTypeInfo | null>(null);
  const [editDtName, setEditDtName] = useState('');
  const [editDtCode, setEditDtCode] = useState('');
  const [editDtDescription, setEditDtDescription] = useState('');
  const [editDtRetentionYears, setEditDtRetentionYears] = useState(5);
  const [editDtDeptId, setEditDtDeptId] = useState<string>('ALL');
  const [editDtFields, setEditDtFields] = useState<CustomFieldDefinition[]>([]);

  const openEditDocTypeModal = (dt: DocumentTypeInfo) => {
    setEditingDocType(dt);
    setEditDtName(dt.name);
    setEditDtCode(dt.code);
    setEditDtDescription(dt.description || '');
    setEditDtRetentionYears(dt.retentionYears);
    setEditDtDeptId(dt.departmentId || 'ALL');
    setEditDtFields((dt.customFields || []).map(f => ({ ...f, options: f.options ? [...f.options] : undefined })));
  };

  const updateEditDtField = (fieldId: string, patch: Partial<CustomFieldDefinition>) => {
    setEditDtFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...patch } : f));
  };

  const removeEditDtField = (fieldId: string) => {
    setEditDtFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const addEditDtFieldDraft = () => {
    setEditDtFields(prev => [...prev, {
      id: `cf-draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: '',
      label: '',
      type: 'text',
      required: true
    }]);
  };

  const handleEditDocTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDocType || !editDtName.trim() || !editDtCode.trim()) return;

    const deptObj = departments.find(d => d.id === editDtDeptId);
    const cleanedFields = editDtFields
      .filter(f => f.label.trim())
      .map(f => ({
        ...f,
        name: f.name || f.label.trim(),
        label: f.label.trim(),
        options: f.type === 'select' ? (f.options || []).map(o => o.trim()).filter(Boolean) : undefined
      }));

    updateDocumentType(editingDocType.id, {
      name: editDtName.trim(),
      code: editDtCode.trim().toUpperCase(),
      description: editDtDescription.trim() || 'Custom Document Classification Type',
      retentionYears: Number(editDtRetentionYears) || 5,
      departmentId: editDtDeptId === 'ALL' ? undefined : editDtDeptId,
      departmentName: editDtDeptId === 'ALL' ? 'All Departments (Universal)' : (deptObj?.name || 'General Department'),
      customFields: cleanedFields
    });

    addNotification('success', `Document Type "${editDtName.trim()}" updated.`);
    setEditingDocType(null);
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
  const [editUserRole, setEditUserRole] = useState<{ id: string; role: string } | null>(null);
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

    const res = await createUser({
      email: newUserEmail.trim(),
      fullName: newUserName.trim(),
      password: newUserPassword || undefined,
      role: newUserRole,
      departmentId: newUserDeptId,
      departmentName: dept ? dept.name : 'General Staff',
      title: newUserTitle.trim() || 'Archive Staff',
      autoApprove: newUserAutoApprove
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

  const handleRoleChange = async (userId: string, newRole: string) => {
    setEditUserRole(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to update role.');
      const chk = availableUsers.find(u => u.id === userId);
      if (chk) {
        setEditUserRole({ id: userId, role: chk.role });
      }
      setEditUserRole(null);
      addNotification('success', `Role updated to ${newRole}.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to update role.');
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

  const handleExportCsv = async (entity: string) => {
    await exportCsv(`/api/export/csv/${entity}`);
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

  // Section disclosure state — Users & roles opens first (approval workflow);
  // everything else stays collapsed with summary badges until needed.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    users: true,
    departments: false,
    docTypes: false,
    fields: false,
    data: false,
    danger: false
  });
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const allOpen = Object.values(openSections).every(Boolean);
  const setAllSections = (open: boolean) =>
    setOpenSections({ users: open, departments: open, docTypes: open, fields: open, data: open, danger: open });

  // Danger zone: reseed requires explicit confirmation
  const [showReseedConfirm, setShowReseedConfirm] = useState(false);

  const csvExports: { entity: string; label: string }[] = [
    { entity: 'documents', label: 'Documents' },
    { entity: 'locations', label: 'Locations' },
    { entity: 'users', label: 'Users' },
    { entity: 'checkouts', label: 'Checkouts' },
    { entity: 'document-types', label: 'Doc Types' },
    { entity: 'movements', label: 'Movements' },
    { entity: 'retention-policies', label: 'Retention Policies' },
    { entity: 'bundles', label: 'Bundles' },
    { entity: 'disposals', label: 'Disposals' },
    { entity: 'audit-logs', label: 'Audit Logs' }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-12">

      <PageHeader
        icon={Settings}
        title="Settings"
        description="Configure archive structure, record types, users, and system operations."
        actions={
          <button type="button" onClick={() => setAllSections(!allOpen)} className="btn btn-ghost btn-sm">
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        }
      />

      {/* ===================== USERS & ROLES ===================== */}
      <SettingsSection
        icon={Users}
        title="Users & roles"
        description="Review registration requests, approve or reject access, and manage accounts."
        open={openSections.users}
        onToggle={() => toggleSection('users')}
        badge={
          <>
            <span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{availableUsers.length} accounts</span>
            {pendingUsers.length > 0 && (
              <span className="chip bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {pendingUsers.length} pending approval
              </span>
            )}
          </>
        }
      >
        <div className="flex justify-end">
          <button type="button" onClick={() => setShowAddUserModal(true)} className="btn btn-primary btn-sm">
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Register new user
          </button>
        </div>

        {/* Pending approval queue */}
        {pendingUsers.length > 0 && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/60 rounded-lg space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span>Pending registration queue ({pendingUsers.length})</span>
              </div>
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                Admin action required before users can sign in
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingUsers.map(user => (
                <div
                  key={user.id}
                  className="p-3 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60 rounded-lg flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-semibold text-xs flex items-center justify-center shrink-0">
                      {user.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{user.fullName}</span>
                        <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">{user.role}</span>
                      </div>
                      <div className="text-[11px] text-teal-600 dark:text-teal-400 font-mono truncate">{user.email}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {user.departmentName} · {user.title || 'Applicant'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button type="button" onClick={() => rejectUser(user.id)} className="btn btn-danger-outline btn-xs">
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => approveUser(user.id)}
                      className="btn btn-xs bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      Approve account
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div role="tablist" aria-label="Filter accounts" className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto text-xs">
          <button
            type="button"
            role="tab"
            aria-selected={userFilterTab === 'ALL'}
            onClick={() => setUserFilterTab('ALL')}
            className={`btn btn-xs ${userFilterTab === 'ALL' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'btn-ghost'}`}
          >
            All ({availableUsers.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={userFilterTab === 'APPROVED'}
            onClick={() => setUserFilterTab('APPROVED')}
            className={`btn btn-xs ${userFilterTab === 'APPROVED' ? 'bg-emerald-600 text-white' : 'btn-ghost'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Approved ({availableUsers.filter(u => (u.approvalStatus || 'APPROVED') === 'APPROVED').length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={userFilterTab === 'PENDING'}
            onClick={() => setUserFilterTab('PENDING')}
            className={`btn btn-xs ${userFilterTab === 'PENDING' ? 'bg-amber-600 text-white' : 'btn-ghost'}`}
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Pending ({availableUsers.filter(u => u.approvalStatus === 'PENDING_APPROVAL').length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={userFilterTab === 'REJECTED'}
            onClick={() => setUserFilterTab('REJECTED')}
            className={`btn btn-xs ${userFilterTab === 'REJECTED' ? 'bg-rose-600 text-white' : 'btn-ghost'}`}
          >
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Rejected ({availableUsers.filter(u => u.approvalStatus === 'REJECTED').length})
          </button>
        </div>

        {/* User list */}
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="th">User & title</th>
                <th className="th">Email</th>
                <th className="th">Role</th>
                <th className="th">Department</th>
                <th className="th">Approval</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
                    <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg text-white font-semibold text-xs flex items-center justify-center shrink-0 ${
                            status === 'PENDING_APPROVAL'
                              ? 'bg-amber-600'
                              : status === 'REJECTED'
                              ? 'bg-rose-600'
                              : 'bg-teal-600'
                          }`}>
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-100">
                              <span>{user.fullName}</span>
                              {user.id === currentUser.id && (
                                <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">Current</span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 block">{user.title || 'Staff User'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="td text-zinc-600 dark:text-zinc-300 font-mono text-[11px]">{user.email}</td>
                      <td className="td">
                        <span className="chip bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 font-mono">{user.role}</span>
                      </td>
                      <td className="td text-zinc-600 dark:text-zinc-300">{user.departmentName}</td>
                      <td className="td">
                        {status === 'APPROVED' && (
                          <span className="chip rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            Approved
                          </span>
                        )}
                        {status === 'PENDING_APPROVAL' && (
                          <span className="chip rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            Pending review
                          </span>
                        )}
                        {status === 'REJECTED' && (
                          <span className="chip rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            <XCircle className="w-3 h-3" aria-hidden="true" />
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                onClick={() => approveUser(user.id)}
                                className="btn btn-xs bg-emerald-600 text-white hover:bg-emerald-700"
                                title="Approve this account"
                              >
                                <Check className="w-3 h-3" aria-hidden="true" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectUser(user.id)}
                                className="btn btn-danger-outline btn-xs"
                                title="Reject this account"
                              >
                                <XCircle className="w-3 h-3" aria-hidden="true" />
                                Reject
                              </button>
                            </>
                          )}

                          {status === 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() => approveUser(user.id)}
                              className="btn btn-primary btn-xs"
                              title="Re-approve this account"
                            >
                              <Check className="w-3 h-3" aria-hidden="true" />
                              Re-approve
                            </button>
                          )}

                          {status === 'APPROVED' && user.id !== currentUser.id && user.id.startsWith('usr-reg-') && (
                            <button
                              type="button"
                              onClick={() => rejectUser(user.id)}
                              className="btn btn-ghost btn-xs hover:text-rose-600"
                              title="Revoke Approval / Suspend Account"
                            >
                              Revoke
                            </button>
                          )}

                          {user.id.startsWith('usr-reg-') ? (
                            <button
                              type="button"
                              onClick={() => deleteUser(user.id)}
                              className="btn btn-ghost btn-icon btn-xs hover:text-rose-600"
                              title="Remove Registered Account"
                              aria-label={`Remove account ${user.fullName}`}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">Demo system user</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </SettingsSection>      {/* ===================== DEPARTMENTS ===================== */}
      <SettingsSection
        icon={Building2}
        title="Departments"
        description="Create, rename, or retire organizational units."
        open={openSections.departments}
        onToggle={() => toggleSection('departments')}
        badge={<span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{departments.length} departments</span>}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setDeptEditing(null); setDeptModalMode('create'); }}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add department
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map(dept => (
            <div key={dept.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="flex justify-between items-center gap-2">
                <span className="font-mono text-xs font-medium text-teal-600 dark:text-teal-400">[{dept.code}]</span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-zinc-400">{dept.documentCount} records</span>
                  <button
                    type="button"
                    onClick={() => { setDeptEditing(dept); setDeptModalMode('edit'); }}
                    className="btn btn-ghost btn-icon btn-xs"
                    title="Edit department"
                    aria-label={`Edit department ${dept.name}`}
                  >
                    <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeptToDelete(dept)}
                    className="btn btn-ghost btn-icon btn-xs hover:text-rose-600"
                    title="Delete department"
                    aria-label={`Delete department ${dept.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{dept.name}</h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Head: {dept.headName}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* ===================== DOCUMENT TYPES & RETENTION ===================== */}
      <SettingsSection
        icon={Layers}
        title="Document types & retention"
        description="Define categories, owning departments, retention periods, and schema fields."
        open={openSections.docTypes}
        onToggle={() => toggleSection('docTypes')}
        badge={<span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{documentTypes.length} types</span>}
      >
        <div className="flex justify-end">
          <button type="button" onClick={() => setShowCreateDocTypeModal(true)} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            New document type
          </button>
        </div>

        {documentTypes.length === 0 ? (
          <div className="empty-state border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
            <SlidersHorizontal className="w-6 h-6 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="font-medium text-zinc-700 dark:text-zinc-300">No document types defined</p>
            <p className="max-w-sm">Create your first document type and classification schema to start registering physical archives.</p>
            <button type="button" onClick={() => setShowCreateDocTypeModal(true)} className="btn btn-primary btn-sm mt-1">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Create document type
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documentTypes.map(dt => (
              <div key={dt.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{dt.name}</h4>
                      <span className="chip bg-white text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 font-mono">{dt.code}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{dt.description}</p>
                    <div className="mt-1.5">
                      <span className="chip bg-zinc-200/60 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        <Building2 className="w-3 h-3 text-teal-500" aria-hidden="true" />
                        {dt.departmentName || 'All Departments (Universal)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">{dt.retentionYears}y retention</span>
                    <button
                      type="button"
                      onClick={() => openEditDocTypeModal(dt)}
                      className="btn btn-ghost btn-icon btn-xs"
                      title="Edit Document Type"
                      aria-label={`Edit document type ${dt.name}`}
                    >
                      <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocTypeToDelete({ id: dt.id, name: dt.name })}
                      className="btn btn-ghost btn-icon btn-xs hover:text-rose-600"
                      title="Delete Document Type"
                      aria-label={`Delete document type ${dt.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Configured custom fields */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Custom fields ({dt.customFields?.length || 0})
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
                      className="btn btn-ghost btn-xs text-teal-600 dark:text-teal-400"
                    >
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      Add field
                    </button>
                  </div>

                  {dt.customFields && dt.customFields.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dt.customFields.map(cf => (
                        <span
                          key={cf.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-[11px]"
                        >
                          <span className="font-medium text-teal-600 dark:text-teal-400">{cf.label}</span>
                          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 rounded uppercase">{cf.type}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomFieldFromDocType(dt.id, cf.id)}
                            className="text-zinc-400 hover:text-rose-600 ml-0.5"
                            title="Remove Field"
                            aria-label={`Remove field ${cf.label}`}
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-400 italic">No custom fields defined for this document type.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      {/* ===================== CUSTOM FIELDS LIBRARY ===================== */}
      <SettingsSection
        icon={SlidersHorizontal}
        title="Custom fields library"
        description="Standard reusable metadata attributes you can attach to any document type."
        open={openSections.fields}
        onToggle={() => toggleSection('fields')}
        badge={<span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{reusableCustomFields.length} fields</span>}
      >
        <div className="flex justify-end">
          <button type="button" onClick={openCreateReusableFieldModal} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            New reusable field
          </button>
        </div>

        {reusableCustomFields.length === 0 ? (
          <div className="empty-state border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
            <p>No reusable custom fields in the library yet. Create common metadata fields to reuse across document categories.</p>
            <button type="button" onClick={openCreateReusableFieldModal} className="btn btn-primary btn-sm mt-1">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Create first field
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reusableCustomFields.map(field => {
              const dept = departments.find(d => d.id === field.departmentId);
              return (
                <div key={field.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">{field.label}</h4>
                      <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 font-mono uppercase shrink-0">{field.type}</span>
                    </div>
                    {field.description && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">{field.description}</p>
                    )}
                    {field.options && field.options.length > 0 && (
                      <div className="text-[11px] text-zinc-500 bg-white dark:bg-zinc-900 p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Options ({field.options.length}): </span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400 line-clamp-1">{field.options.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">
                      {field.isGlobal || !field.departmentId ? 'Universal (all depts)' : (dept ? dept.name : 'Department-specific')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditReusableFieldModal(field.id)}
                        className="btn btn-ghost btn-icon btn-xs"
                        title="Edit Field"
                        aria-label={`Edit field ${field.label}`}
                      >
                        <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRcfToDelete({ id: field.id, name: field.label })}
                        className="btn btn-ghost btn-icon btn-xs hover:text-rose-600"
                        title="Delete Field"
                        aria-label={`Delete field ${field.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {/* ===================== DATABASE & BACKUPS ===================== */}
      <SettingsSection
        icon={Database}
        title="Database & backups"
        description="Connection health, dataset statistics, full backup export, and CSV exports."
        open={openSections.data}
        onToggle={() => toggleSection('data')}
        badge={
          <span className={`chip rounded-full ${
            dbHealth?.connected
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dbHealth?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
            {dbHealth?.connected ? 'PostgreSQL active' : 'Fallback storage'}
          </span>
        }
      >
        {/* Connection status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="meta max-w-2xl">
            ArchiveHub runs on PostgreSQL via Drizzle ORM, driven by the <code className="font-mono text-teal-600 dark:text-teal-400 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">DATABASE_URL</code> environment variable — portable between Supabase (development) and a self-hosted Docker container (production).
          </p>
          <button type="button" onClick={refreshDbHealth} className="btn btn-secondary btn-sm shrink-0">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Check health
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="meta block">Database provider</span>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dbHealth?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
              Provider-agnostic PostgreSQL
            </div>
            <span className="text-[11px] text-zinc-500 block">Supabase / self-hosted Docker PG</span>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="meta block">ORM & driver</span>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">Drizzle ORM + pg (Pool)</div>
            <span className="text-[11px] text-zinc-500 block">Typed relational queries & transactions</span>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="meta block">Connection health</span>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs truncate">{dbHealth?.message || 'Awaiting status query...'}</div>
            <span className="text-[11px] text-zinc-500 block">
              {dbHealth?.timestamp ? `Last checked: ${new Date(dbHealth.timestamp).toLocaleTimeString()}` : 'Click "Check health" to test'}
            </span>
          </div>
        </div>

        {/* Supabase setup instructions when disconnected */}
        {!dbHealth?.connected && (
          <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs space-y-2">
            <div className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              How to connect your Supabase PostgreSQL database
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-amber-800 dark:text-amber-300 leading-relaxed pl-1">
              <li>
                In your Supabase Dashboard, go to <strong>Project Settings &rarr; Database &rarr; Connection String</strong> (URI tab).
              </li>
              <li>
                Copy the connection string (e.g., <code className="bg-amber-100 dark:bg-amber-900/80 px-1 py-0.5 rounded font-mono text-[11px]">postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require</code>).
              </li>
              <li>
                In your project workspace, create a <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.env</code> file (or copy <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.env.example</code> to <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.env</code>) and paste your string:
                <div className="mt-1 font-mono text-[11px] bg-zinc-900 text-emerald-400 p-2.5 rounded-lg overflow-x-auto selection:bg-emerald-800">
                  DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"
                </div>
              </li>
              <li>
                Click <span className="font-semibold underline">Check health</span> above. When the status turns green, use <span className="font-semibold underline">Reset & reseed demo data</span> in the Danger Zone below to generate all relational tables automatically.
              </li>
            </ol>
          </div>
        )}

        {/* Dataset stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="meta block">Catalog records</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">{documents.length} documents</div>
            <span className="text-[11px] text-zinc-500 block">Registered physical and digital archive items</span>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="meta block">Storage hierarchy</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">{locations.length} physical nodes</div>
            <span className="text-[11px] text-zinc-500 block">Buildings, floors, rooms, cabinets, shelves, and boxes</span>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="meta block">Circulation ledger</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">{checkouts.length} borrow requests</div>
            <span className="text-[11px] text-zinc-500 block">Active checkouts, returns, and circulation history</span>
          </div>
        </div>

        {/* Backup & restore */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div>
            <h4 className="section-title">Backup & restore</h4>
            <p className="meta mt-0.5">Export every table as a full JSON backup, or restore from a previously exported file.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFileSelected}
            />
            <button type="button" onClick={handleExportFullBackup} disabled={isExporting} className="btn btn-primary btn-sm">
              <Download className="w-4 h-4" aria-hidden="true" />
              {isExporting ? 'Preparing export...' : 'Export full backup'}
            </button>
            <button type="button" onClick={() => importFileRef.current?.click()} disabled={isImporting} className="btn btn-secondary btn-sm">
              <Upload className="w-4 h-4" aria-hidden="true" />
              {isImporting ? 'Restoring...' : 'Import / restore backup'}
            </button>
          </div>

          <div>
            <span className="label">Per-table CSV exports</span>
            <div className="flex flex-wrap gap-1.5">
              {csvExports.map(({ entity, label }) => (
                <button key={entity} type="button" onClick={() => handleExportCsv(entity)} className="btn btn-secondary btn-xs">
                  <Download className="w-3 h-3" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ===================== DANGER ZONE ===================== */}
      <SettingsSection
        icon={ShieldAlert}
        title="Danger zone"
        description="Destructive operations that replace the current dataset."
        open={openSections.danger}
        onToggle={() => toggleSection('danger')}
        tone="danger"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/30">
          <div>
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Reset & reseed demo data</h4>
            <p className="meta mt-0.5 max-w-xl">
              Runs database migrations and reseeds all tables with the default demo dataset. All current records will be replaced. Export a full backup first if you need to keep your data.
            </p>
          </div>
          <button type="button" onClick={() => setShowReseedConfirm(true)} className="btn btn-danger-outline btn-sm shrink-0">
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            Run migration & seed
          </button>
        </div>
      </SettingsSection>      {/* ===================== MODALS ===================== */}

      {/* Add Custom Field to Document Type (reusable library or new field) */}
      {showFieldModal && activeDocTypeForFields && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true" aria-label="Add custom field">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 shrink-0">
              <div>
                <h3 className="section-title flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  Add custom field to {documentTypes.find(dt => dt.id === activeDocTypeForFields)?.name}
                </h3>
                <p className="meta mt-0.5">Attach a standard field from your library or define a new one.</p>
              </div>
              <button type="button" onClick={() => setShowFieldModal(false)} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Field source" className="flex border-b border-zinc-200 dark:border-zinc-800 px-5 text-xs">
              <button
                type="button"
                role="tab"
                aria-selected={fieldModalTab === 'reusable'}
                onClick={() => setFieldModalTab('reusable')}
                className={`py-3 px-4 font-medium border-b-2 transition-colors ${
                  fieldModalTab === 'reusable'
                    ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                From library ({reusableCustomFields.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fieldModalTab === 'custom'}
                onClick={() => setFieldModalTab('custom')}
                className={`py-3 px-4 font-medium border-b-2 transition-colors ${
                  fieldModalTab === 'custom'
                    ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Create new field
              </button>
            </div>

            {fieldModalTab === 'reusable' ? (
              <div className="p-5 overflow-y-auto flex-1 text-xs space-y-3">
                {reusableCustomFields.length === 0 ? (
                  <div className="empty-state">
                    <p>No reusable fields available in the library.</p>
                    <button type="button" onClick={() => setFieldModalTab('custom')} className="btn btn-primary btn-sm">
                      Define a new field instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="meta">Click "Attach" on any reusable field below to add it to this document type.</p>
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {reusableCustomFields.map(rcf => {
                        const targetDt = documentTypes.find(dt => dt.id === activeDocTypeForFields);
                        const isAlreadyAdded = targetDt?.customFields?.some(cf => cf.name.toLowerCase() === rcf.name.toLowerCase());

                        return (
                          <div
                            key={rcf.id}
                            className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{rcf.label}</span>
                                <span className="chip bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 font-mono uppercase">{rcf.type}</span>
                              </div>
                              {rcf.options && rcf.options.length > 0 && (
                                <p className="text-[11px] text-zinc-500 truncate">Options: {rcf.options.join(', ')}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={isAlreadyAdded}
                              onClick={() => handleAttachReusableField(rcf.id)}
                              className={`btn btn-sm shrink-0 ${isAlreadyAdded ? 'btn-secondary' : 'btn-primary'}`}
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
                <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
                  <div>
                    <label className="label">Field label / name *</label>
                    <input
                      type="text"
                      required
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      placeholder="e.g. Period, Fund Source, Office, Category"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">Field input type</label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as any)}
                      className="input"
                    >
                      <option value="select">Select dropdown (predefined options)</option>
                      <option value="text">Short text input</option>
                      <option value="number">Number input</option>
                      <option value="date">Date picker</option>
                    </select>
                  </div>

                  {fieldType === 'select' && (
                    <div>
                      <label className="label">Dropdown options (comma-separated) *</label>
                      <textarea
                        required
                        rows={3}
                        value={fieldOptions}
                        onChange={(e) => setFieldOptions(e.target.value)}
                        placeholder="e.g. 101 General Fund, 102 Special Education Fund, 151 Trust Fund"
                        className="input resize-none"
                      />
                      <p className="field-hint">Separate multiple dropdown choices with commas.</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAlsoAsReusable}
                        onChange={(e) => setSaveAlsoAsReusable(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                      />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Also save into the reusable fields library for other document types
                      </span>
                    </label>
                  </div>
                </div>

                <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
                  <button type="button" onClick={() => setShowFieldModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save field</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Reusable Custom Field */}
      {showReusableFieldModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true" aria-label="Reusable custom field">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 shrink-0">
              <h3 className="section-title flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                {editingReusableFieldId ? 'Edit reusable custom field' : 'New reusable custom field'}
              </h3>
              <button type="button" onClick={() => setShowReusableFieldModal(false)} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveReusableField} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="label">Field label / display name *</label>
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
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Internal key / identifier *</label>
                    <input
                      type="text"
                      required
                      value={rcfName}
                      onChange={(e) => setRcfName(e.target.value)}
                      placeholder="e.g. period, fundSource"
                      className="input font-mono"
                    />
                  </div>

                  <div>
                    <label className="label">Field type</label>
                    <select
                      value={rcfType}
                      onChange={(e) => setRcfType(e.target.value as any)}
                      className="input"
                    >
                      <option value="select">Select dropdown</option>
                      <option value="text">Text input</option>
                      <option value="number">Number input</option>
                      <option value="date">Date picker</option>
                    </select>
                  </div>
                </div>

                {rcfType === 'select' && (
                  <div>
                    <label className="label">Dropdown options (comma-separated) *</label>
                    <textarea
                      required
                      rows={3}
                      value={rcfOptions}
                      onChange={(e) => setRcfOptions(e.target.value)}
                      placeholder="e.g. Q1 2024, Q2 2024, Q3 2024, Q4 2024"
                      className="input resize-none"
                    />
                  </div>
                )}

                <div>
                  <label className="label">Department scope</label>
                  <select
                    value={rcfDeptId}
                    onChange={(e) => setRcfDeptId(e.target.value)}
                    className="input"
                  >
                    <option value="ALL">Universal (available to all departments)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} only</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Description / archival context (optional)</label>
                  <input
                    type="text"
                    value={rcfDescription}
                    onChange={(e) => setRcfDescription(e.target.value)}
                    placeholder="e.g. Used for accounting and financial ledgers"
                    className="input"
                  />
                </div>
              </div>

              <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowReusableFieldModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingReusableFieldId ? 'Update field' : 'Save to library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Reusable Field Confirmation */}
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

      {/* Import / Restore Backup Confirmation */}
      <ConfirmModal
        isOpen={Boolean(pendingImport)}
        onClose={() => { if (!isImporting) setPendingImport(null); }}
        onConfirm={confirmImportRestore}
        title="Restore Database from Backup"
        message={`You are about to import "${pendingImport?.fileName || ''}". This will completely REPLACE all current data (documents, locations, bundles, users, checkouts, movements, audit logs, and settings) with the contents of the backup file. This action cannot be undone. Do you want to continue?`}
        confirmText={isImporting ? 'Restoring...' : 'Yes, Restore Backup'}
        variant="danger"
      />

      {/* Reseed Confirmation (Danger Zone) */}
      <ConfirmModal
        isOpen={showReseedConfirm}
        onClose={() => setShowReseedConfirm(false)}
        onConfirm={() => {
          setShowReseedConfirm(false);
          reseedDatabase();
        }}
        title="Reset & Reseed Demo Data"
        message="This runs migrations and replaces ALL current data with the default demo dataset. Export a full backup first if you need to keep your records. Continue?"
        confirmText="Yes, Reset & Reseed"
        variant="danger"
      />

      {/* Add User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true" aria-label="Register new user">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 shrink-0">
              <h3 className="section-title flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                Register new user account
              </h3>
              <button type="button" onClick={() => setShowAddUserModal(false)} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
                {formError && (
                  <div className="p-2.5 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-900 rounded-lg text-xs">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="label">Full name *</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. David Miller"
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">Email address *</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="e.g. d.miller@archivehub.org"
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Department</label>
                    <select
                      value={newUserDeptId}
                      onChange={(e) => setNewUserDeptId(e.target.value)}
                      className="input"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Job title</label>
                    <input
                      type="text"
                      value={newUserTitle}
                      onChange={(e) => setNewUserTitle(e.target.value)}
                      placeholder="e.g. Archivist"
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">System role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as RoleCode)}
                    className="input"
                  >
                    <option value="DEPT_USER">Department User</option>
                    <option value="RECORDS_OFFICER">Records Officer</option>
                    <option value="RECORDS_ADMIN">Records Administrator</option>
                    <option value="ADMIN">System Administrator</option>
                    <option value="AUDITOR">Auditor</option>
                  </select>
                </div>

                <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/60 rounded-lg">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUserAutoApprove}
                      onChange={(e) => setNewUserAutoApprove(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-zinc-300"
                    />
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Auto-approve account immediately</span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                        If checked, the user can sign in immediately without waiting in the approval queue.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowAddUserModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Register account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Document Type */}
      {showCreateDocTypeModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true" aria-label="Create document type">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 shrink-0">
              <h3 className="section-title flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                Create new document type
              </h3>
              <button type="button" onClick={() => setShowCreateDocTypeModal(false)} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateDocTypeSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="label">Document type name *</label>
                  <input
                    type="text"
                    required
                    value={newDtName}
                    onChange={(e) => setNewDtName(e.target.value)}
                    placeholder="e.g. Environmental Impact Assessment, Executive Order"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Owning department association *</label>
                  <select
                    value={newDtDeptId}
                    onChange={(e) => setNewDtDeptId(e.target.value)}
                    className="input"
                  >
                    <option value="ALL">Universal (all departments)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                  <p className="field-hint">When adding physical documents, this document type will only show up when its tied department is selected.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Classification code *</label>
                    <input
                      type="text"
                      required
                      value={newDtCode}
                      onChange={(e) => setNewDtCode(e.target.value)}
                      placeholder="e.g. EIA, EO, CWR"
                      className="input font-mono uppercase text-teal-600 dark:text-teal-400"
                    />
                  </div>

                  <div>
                    <label className="label">Retention period (years) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={newDtRetentionYears}
                      onChange={(e) => setNewDtRetentionYears(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Description / archival purpose</label>
                  <textarea
                    rows={3}
                    value={newDtDescription}
                    onChange={(e) => setNewDtDescription(e.target.value)}
                    placeholder="Describe the scope, compliance rules, or archival category..."
                    className="input resize-none"
                  />
                </div>
              </div>

              <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowCreateDocTypeModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create document type</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Document Type */}
      {editingDocType && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true" aria-label="Edit document type">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 shrink-0">
              <h3 className="section-title flex items-center gap-2">
                <Edit className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                Edit document type
              </h3>
              <button type="button" onClick={() => setEditingDocType(null)} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleEditDocTypeSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="label">Document type name *</label>
                  <input
                    type="text"
                    required
                    value={editDtName}
                    onChange={(e) => setEditDtName(e.target.value)}
                    placeholder="e.g. Environmental Impact Assessment, Executive Order"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Owning department association *</label>
                  <select
                    value={editDtDeptId}
                    onChange={(e) => setEditDtDeptId(e.target.value)}
                    className="input"
                  >
                    <option value="ALL">Universal (all departments)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                  <p className="field-hint">When adding physical documents, this document type will only show up when its tied department is selected.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Classification code *</label>
                    <input
                      type="text"
                      required
                      value={editDtCode}
                      onChange={(e) => setEditDtCode(e.target.value)}
                      placeholder="e.g. EIA, EO, CWR"
                      className="input font-mono uppercase text-teal-600 dark:text-teal-400"
                    />
                  </div>

                  <div>
                    <label className="label">Retention period (years) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={editDtRetentionYears}
                      onChange={(e) => setEditDtRetentionYears(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Description / archival purpose</label>
                  <textarea
                    rows={3}
                    value={editDtDescription}
                    onChange={(e) => setEditDtDescription(e.target.value)}
                    placeholder="Describe the scope, compliance rules, or archival category..."
                    className="input resize-none"
                  />
                </div>

                {/* Custom Fields Schema Editor */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">Custom fields schema ({editDtFields.length})</span>
                      <p className="field-hint flex items-center gap-1">
                        <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                        Field types of existing fields are locked to protect data already recorded on documents. You may still edit labels/options or add new fields.
                      </p>
                    </div>
                    <button type="button" onClick={addEditDtFieldDraft} className="btn btn-primary btn-xs shrink-0">
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      Add field
                    </button>
                  </div>

                  {editDtFields.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic py-1">No custom fields defined for this document type.</p>
                  ) : (
                    editDtFields.map(cf => {
                      const isOriginal = Boolean(editingDocType.customFields?.some(f => f.id === cf.id));
                      return (
                        <div key={cf.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={cf.label}
                              onChange={(e) => updateEditDtField(cf.id, { label: e.target.value })}
                              placeholder="Field label, e.g. Fund Source"
                              className="input flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => removeEditDtField(cf.id)}
                              className="btn btn-ghost btn-icon btn-xs hover:text-rose-600 shrink-0"
                              title="Remove Field"
                              aria-label="Remove field"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={cf.type}
                              disabled={isOriginal}
                              onChange={(e) => updateEditDtField(cf.id, { type: e.target.value as CustomFieldType })}
                              className={`input w-auto font-mono uppercase text-[11px] ${isOriginal ? 'cursor-not-allowed' : ''}`}
                              title={isOriginal ? 'Field type cannot be changed once defined' : 'Field type'}
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="select">Select</option>
                            </select>
                            {isOriginal && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                                <Lock className="w-3 h-3" aria-hidden="true" />
                                Type locked
                              </span>
                            )}
                            <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cf.required ?? false}
                                onChange={(e) => updateEditDtField(cf.id, { required: e.target.checked })}
                                className="w-3.5 h-3.5 rounded border-zinc-300 text-teal-600"
                              />
                              Required
                            </label>
                          </div>

                          {cf.type === 'select' && (
                            <input
                              type="text"
                              value={(cf.options || []).join(', ')}
                              onChange={(e) => updateEditDtField(cf.id, { options: e.target.value.split(',') })}
                              placeholder="Options separated by commas, e.g. Low, Medium, High"
                              className="input"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setEditingDocType(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Document Type Confirmation */}
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

      {/* Department Create/Edit */}
      {deptModalMode && (
        <DepartmentModal
          mode={deptModalMode}
          department={deptEditing || undefined}
          onClose={() => { setDeptModalMode(null); setDeptEditing(null); }}
        />
      )}

      {/* Delete Department Confirmation */}
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
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="card max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true" aria-label="Department">
        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 shrink-0">
          <h3 className="section-title flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            {mode === 'create' ? 'Add new department' : `Edit department — ${department?.code}`}
          </h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close dialog">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
            <div>
              <label className="label">Department code *</label>
              <input
                type="text"
                required
                maxLength={20}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. HRD, FIN, OPS"
                className="input font-mono uppercase text-teal-600 dark:text-teal-400"
              />
            </div>

            <div>
              <label className="label">Department name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Human Resource Development"
                className="input"
              />
              {mode === 'edit' && (
                <p className="field-hint">Renaming a department also updates the stored department name on its documents, bundles, document types and user accounts.</p>
              )}
            </div>

            <div>
              <label className="label">Department head *</label>
              <input
                type="text"
                required
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 shrink-0">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : (mode === 'create' ? 'Create department' : 'Save changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};