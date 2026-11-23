import React, { useState } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { UserCircle, X, Save, KeyRound, Building2 } from 'lucide-react';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { currentUser, departments, updateUserProfile } = useArchive();

  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [title, setTitle] = useState(currentUser.title || '');
  const [departmentId, setDepartmentId] = useState(currentUser.departmentId || '');

  // Password change (optional)
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Email address is required.');
      return;
    }

    const updates: Record<string, string> = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      title: title.trim(),
      departmentId,
      departmentName: departments.find(d => d.id === departmentId)?.name || currentUser.departmentName
    };

    if (showPasswordSection && newPassword) {
      if (newPassword.length < 6) {
        setFormError('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setFormError('New password and confirmation do not match.');
        return;
      }
      if (!currentPassword) {
        setFormError('Please enter your current password to confirm the change.');
        return;
      }
      updates.currentPassword = currentPassword;
      updates.newPassword = newPassword;
    }

    setIsSaving(true);
    try {
      const res = await updateUserProfile(currentUser.id, updates);
      if (res.success) {
        onClose();
      } else {
        setFormError(res.message || 'Failed to update profile.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="card max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h3 className="section-title">
              My Profile & Account Information
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">

            {/* Role Badge (read-only, admin-controlled) */}
            <div className="flex items-center justify-between p-3 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-xl">
              <div>
                <span className="block text-[10px] uppercase font-bold text-teal-500 dark:text-teal-400 tracking-wider">Assigned System Role</span>
                <span className="font-bold text-teal-900 dark:text-teal-200">{currentUser.role}</span>
              </div>
              <span className="text-[10px] text-teal-600 dark:text-teal-300 italic">Managed by Administrators</span>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 font-semibold">
                {formError}
              </div>
            )}

            <div>
              <label className="label">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input font-medium"
              />
            </div>

            <div>
              <label className="label">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input font-mono"
              />
            </div>

            <div>
              <label className="label">
                Job Title / Position
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Records Officer II"
                className="input font-medium"
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="input font-semibold"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Optional Password Change Section */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(prev => !prev);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="flex items-center gap-2 font-semibold text-xs text-zinc-800 dark:text-zinc-200 w-full"
              >
                <KeyRound className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{showPasswordSection ? 'Cancel Password Change' : 'Change My Password (Optional)'}</span>
              </button>

              {showPasswordSection && (
                <div className="space-y-2.5 pt-1 border-t border-zinc-200 dark:border-zinc-700 animate-in fade-in">
                  <div>
                    <label className="label">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="label">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                  <p className="field-hint">
                    Minimum 6 characters. Your current password is required to confirm the change.
                  </p>
                </div>
              )}
            </div>

          </div>

          <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
