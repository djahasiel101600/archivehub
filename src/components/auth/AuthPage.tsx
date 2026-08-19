import React, { useState } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { 
  Archive, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  User as UserIcon, 
  Lock, 
  Mail, 
  Building2, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { RoleCode } from '../../types';

export const AuthPage: React.FC = () => {
  const { loginUser, signupUser, departments } = useArchive();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  
  // Sign in form state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [isPendingError, setIsPendingError] = useState(false);

  // Sign up form state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpDeptId, setSignUpDeptId] = useState('dept-01');
  const [signUpRole, setSignUpRole] = useState<RoleCode>('DEPT_USER');
  const [signUpTitle, setSignUpTitle] = useState('');
  const [signUpError, setSignUpError] = useState('');

  // Pending Registration screen state
  const [registrationSubmitted, setRegistrationSubmitted] = useState<{
    fullName: string;
    email: string;
    role: RoleCode;
    departmentName: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setIsPendingError(false);

    if (!signInEmail.trim()) {
      setSignInError('Please enter your email address.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await loginUser(signInEmail, signInPassword);
      if (!res.success) {
        setSignInError(res.message || 'Failed to sign in.');
        if (res.isPendingApproval) {
          setIsPendingError(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');

    if (!signUpName.trim()) {
      setSignUpError('Full name is required.');
      return;
    }
    if (!signUpEmail.trim()) {
      setSignUpError('Email address is required.');
      return;
    }

    const selectedDept = departments.find(d => d.id === signUpDeptId);
    const departmentName = selectedDept ? selectedDept.name : 'General Staff';

    setIsSubmitting(true);
    try {
      const res = await signupUser({
        fullName: signUpName.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        role: signUpRole,
        departmentId: signUpDeptId,
        departmentName,
        title: signUpTitle.trim() || 'Archive System User'
      });

      if (res.success) {
        setRegistrationSubmitted({
          fullName: signUpName.trim(),
          email: signUpEmail.trim(),
          role: signUpRole,
          departmentName
        });
        // Clear sign up form
        setSignUpName('');
        setSignUpEmail('');
        setSignUpPassword('');
        setSignUpTitle('');
      } else {
        setSignUpError(res.message || 'Failed to register user account.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleDescriptions: Record<RoleCode, { name: string; desc: string; badge: string }> = {
    ADMIN: { name: 'System Administrator', desc: 'Full administrative access to configure system settings, users, and locations.', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
    RECORDS_ADMIN: { name: 'Records Administrator', desc: 'Can manage document cataloging, approve checkouts, and define retention rules.', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    RECORDS_OFFICER: { name: 'Records Officer', desc: 'Handles circulation desk, physical movement tagging, and check-in returns.', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    DEPT_USER: { name: 'Department User', desc: 'Can search documents, submit borrow checkout requests, and view assigned files.', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    AUDITOR: { name: 'Auditor & Compliance', desc: 'Read-only access to immutable audit trails, disposal logs, and movements.', badge: 'bg-amber-100 text-amber-800 border-amber-200' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-500/30">
          <Archive className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            ArchiveHub
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
              PDAMS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Physical & Digital Archive Management System
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6">
          
          {/* REGISTRATION SUBMITTED / PENDING APPROVAL CONFIRMATION SCREEN */}
          {registrationSubmitted ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-white">Registration Submitted!</h2>
                  <p className="text-xs font-bold text-amber-400 tracking-wide uppercase">
                    Awaiting Administrator Approval
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  Your new account request has been registered in the system. For organizational security, new accounts <strong className="text-white">cannot sign in immediately</strong> and must wait for an <strong className="text-indigo-300">Administrator</strong> to review and activate your account.
                </p>

                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Registered Name:</span>
                    <span className="font-semibold text-white">{registrationSubmitted.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Email Address:</span>
                    <span className="font-mono text-indigo-300">{registrationSubmitted.email}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Requested Role:</span>
                    <span className="font-semibold text-amber-300">{roleDescriptions[registrationSubmitted.role].name}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Department:</span>
                    <span className="font-semibold text-slate-200">{registrationSubmitted.departmentName}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl flex items-start gap-2.5 text-xs text-indigo-200">
                <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>Once approved by an Admin, you will be able to sign in using your registered email and password.</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRegistrationSubmitted(null);
                  setMode('signin');
                  setSignInEmail(registrationSubmitted.email);
                  setSignInError('');
                  setIsPendingError(false);
                }}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Return to Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Mode Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setSignInError(''); setIsPendingError(false); }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    mode === 'signin'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setSignUpError(''); }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    mode === 'signup'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </button>
              </div>

              {/* SIGN IN FORM */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white">Sign In to Your Workspace</h2>
                    <p className="text-xs text-slate-400">
                      Enter your email address and password to access the workspace.
                    </p>
                  </div>

                  {signInError && (
                    <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                      isPendingError
                        ? 'bg-amber-950/60 border-amber-800/80 text-amber-200'
                        : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                    }`}>
                      {isPendingError ? (
                        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        {isPendingError && (
                          <div className="font-bold text-amber-300 mb-0.5">Account Pending Approval</div>
                        )}
                        <span>{signInError}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={signInEmail}
                          onChange={(e) => setSignInEmail(e.target.value)}
                          placeholder="e.g. your.email@archivehub.org"
                          className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold text-xs text-white rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    {isSubmitting ? 'Signing In...' : 'Sign In to ArchiveHub'}
                  </button>
                </form>
              )}

              {/* SIGN UP FORM */}
              {mode === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white">Create New User Account</h2>
                    <p className="text-xs text-slate-400">
                      Register a user account. New accounts will be reviewed and approved by an Administrator.
                    </p>
                  </div>

                  {signUpError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      <span>{signUpError}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Full Name *
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          placeholder="e.g. Sarah Jenkins"
                          className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          placeholder="e.g. s.jenkins@archivehub.org"
                          className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Department
                        </label>
                        <select
                          value={signUpDeptId}
                          onChange={(e) => setSignUpDeptId(e.target.value)}
                          className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors"
                        >
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Job Title
                        </label>
                        <input
                          type="text"
                          value={signUpTitle}
                          onChange={(e) => setSignUpTitle(e.target.value)}
                          placeholder="e.g. Archival Specialist"
                          className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        System Role & Permissions
                      </label>
                      <select
                        value={signUpRole}
                        onChange={(e) => setSignUpRole(e.target.value as RoleCode)}
                        className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white rounded-xl outline-none transition-colors font-bold"
                      >
                        <option value="DEPT_USER">Department User (Borrower & Search)</option>
                        <option value="RECORDS_OFFICER">Records Officer (Circulation & Tagging)</option>
                        <option value="RECORDS_ADMIN">Records Administrator (Cataloger & Approver)</option>
                        <option value="ADMIN">System Administrator (Full System Controller)</option>
                        <option value="AUDITOR">Auditor (Read-Only Compliance Logs)</option>
                      </select>

                      <div className="mt-2 p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px]">
                        <span className="font-bold text-indigo-300 block mb-0.5">
                          {roleDescriptions[signUpRole].name}
                        </span>
                        <p className="text-slate-400">
                          {roleDescriptions[signUpRole].desc}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-300">
                    <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>Note: Newly created accounts require Admin approval before you can sign in.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold text-xs text-white rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    {isSubmitting ? 'Submitting Registration...' : 'Submit Account for Admin Approval'}
                  </button>
                </form>
              )}
            </>
          )}

        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          ArchiveHub Enterprise &bull; Physical & Digital Record Tracking Engine
        </div>
      </div>

    </div>
  );
};
