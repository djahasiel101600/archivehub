import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  User, 
  LocationItem, 
  DocumentItem, 
  CheckoutRecord, 
  MovementRecord, 
  AuditLogRecord,
  Department,
  DocumentTypeInfo,
  ReusableCustomField,
  DocumentBundle,
  NewDocumentItem
} from '../types';
import { calculateLocationPath } from '../utils/locationUtils';

export interface DbHealthState {
  connected: boolean;
  message: string;
  timestamp: string;
}

// Collections that can be re-fetched individually after a mutation, so a
// single write does not trigger a full 11-endpoint resync.
type RefreshableEntity =
  | 'departments' | 'documentTypes' | 'locations' | 'documents' | 'checkouts'
  | 'movements' | 'auditLogs' | 'users' | 'reusableCustomFields' | 'bundles';

const FALLBACK_ADMIN_USER: User = {
  id: 'usr-001',
  email: 'admin@archivehub.internal',
  fullName: 'System Administrator',
  role: 'ADMIN',
  departmentId: 'dept-01',
  departmentName: 'Archives & Records Management',
  approvalStatus: 'APPROVED'
};

interface ArchiveContextType {
  // Current user & authentication session
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isAuthenticated: boolean;
  registeredUsers: User[];
  availableUsers: User[];
  pendingUsers: User[];
  pendingUsersCount: number;
  
  // Auth operations
  loginUser: (email: string, password?: string) => Promise<{ success: boolean; message?: string; user?: User; isPendingApproval?: boolean }>;
  signupUser: (userData: Omit<User, 'id'> & { password?: string }) => Promise<{ success: boolean; message?: string; user?: User; isPendingApproval?: boolean }>;
  createUser: (userData: { email: string; fullName: string; password?: string; role: string; departmentId?: string; departmentName?: string; title?: string; autoApprove?: boolean }) => Promise<{ success: boolean; message?: string; user?: User; tempPassword?: string }>;
  logoutUser: () => void;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => void;
  updateUserProfile: (userId: string, updates: Partial<User> & { currentPassword?: string; newPassword?: string }) => Promise<{ success: boolean; message?: string }>;
  // Data Backup & Restore
  exportAllData: () => Promise<{ success: boolean; message?: string; blob?: Blob }>;
  exportCsv: (endpoint: string) => Promise<{ success: boolean; message?: string; filename?: string }>;
  importAllData: (payload: any) => Promise<{ success: boolean; message?: string; counts?: Record<string, number> }>;

  // Data State
  departments: Department[];
  addDepartment: (dept: Omit<Department, 'id' | 'documentCount'>) => Promise<Department | null>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: string) => Promise<boolean>;
  documentTypes: DocumentTypeInfo[];
  addDocumentType: (docType: Omit<DocumentTypeInfo, 'id'>) => Promise<DocumentTypeInfo>;
  updateDocumentType: (id: string, updates: Partial<DocumentTypeInfo>) => Promise<void>;
  deleteDocumentType: (id: string) => Promise<void>;
  reusableCustomFields: ReusableCustomField[];
  addReusableCustomField: (field: Omit<ReusableCustomField, 'id' | 'createdAt'>) => Promise<ReusableCustomField>;
  updateReusableCustomField: (id: string, updates: Partial<ReusableCustomField>) => Promise<void>;
  deleteReusableCustomField: (id: string) => Promise<void>;
  bundles: DocumentBundle[];
  addBundle: (bundle: Omit<DocumentBundle, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode'>) => Promise<DocumentBundle>;
  updateBundle: (id: string, updates: Partial<DocumentBundle>) => Promise<void>;
  deleteBundle: (id: string) => Promise<void>;
  addDocumentsToBundle: (bundleId: string, documentIds: string[]) => Promise<void>;
  removeDocumentFromBundle: (bundleId: string, documentId: string) => Promise<void>;
  locations: LocationItem[];
  documents: DocumentItem[];
  checkouts: CheckoutRecord[];
  movements: MovementRecord[];
  auditLogs: AuditLogRecord[];
  
  // Quick Search & Navigation
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  
  // Location Operations
  addLocation: (location: Omit<LocationItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'currentOccupancy'>) => Promise<LocationItem>;
  updateLocation: (id: string, updates: Partial<LocationItem>) => Promise<void>;
  deleteLocation: (id: string) => Promise<boolean>;
  
  // Document Operations
  addDocument: (doc: NewDocumentItem) => Promise<DocumentItem>;
  getNextDocumentNumber: (departmentId: string, typeId: string) => Promise<string | null>;
  updateDocument: (id: string, updates: Partial<DocumentItem>) => Promise<void>;
  uploadDigitalCopy: (id: string, file: File, version?: number) => Promise<{ success: boolean; message?: string }>;
  deleteDocument: (id: string) => Promise<boolean>;
  bulkUpdateDocuments: (documentIds: string[], updates: Partial<DocumentItem>) => Promise<{ updated: number; errors: string[] }>;
  bulkDeleteDocuments: (documentIds: string[]) => Promise<{ deleted: number; skipped: { id: string; reason: string }[] }>;
  moveDocument: (documentId: string, toLocationId: string, reason: string) => Promise<void>;
  batchMoveDocuments: (documentIds: string[], toLocationId: string, reason: string) => Promise<{ moved: number; errors: Array<{ id: string; reason: string }> }>;
  claimDocumentQr: (documentId: string) => Promise<{ success: boolean; message?: string; claimedAt?: string }>;
  unclaimDocumentQr: (documentId: string) => Promise<{ success: boolean; message?: string }>;
  
  // Checkout & Return Operations
  requestCheckout: (documentId: string, purpose: string, dueDate: string) => Promise<CheckoutRecord>;
  approveCheckout: (checkoutId: string) => Promise<void>;
  rejectCheckout: (checkoutId: string, reason: string) => Promise<void>;
  processCheckoutDispatch: (checkoutId: string, tempLocationId: string) => Promise<void>;
  processCheckInReturn: (checkoutId: string, conditionIn: DocumentItem['condition'], returnLocationId: string, notes?: string) => Promise<void>;
  
  // Helper Lookups
  lookupByQR: (qrString: string) => { type: 'DOCUMENT' | 'LOCATION' | 'BUNDLE'; data: DocumentItem | LocationItem | DocumentBundle } | null;
  lookupByQRRemote: (code: string) => Promise<{ type: 'DOCUMENT' | 'LOCATION' | 'BUNDLE'; data: DocumentItem | LocationItem | DocumentBundle } | null>;
  calculatePath: (locationId: string | null) => string;
  
  // Notifications
  notifications: Array<{ id: string; type: 'info' | 'success' | 'warning' | 'error'; message: string; timestamp: string }>;
  dismissNotification: (id: string) => void;
  addNotification: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  
  // Database Health & Management
  dbHealth: DbHealthState | null;
  refreshDbHealth: () => Promise<DbHealthState>;
  reseedDatabase: () => Promise<void>;
}

const ArchiveContext = createContext<ArchiveContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'archivehub_auth_session';

export const ArchiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbHealth, setDbHealth] = useState<DbHealthState | null>(null);

  // Helper to load persisted session from localStorage
  const getInitialAuthState = (): { user: User; isAuthenticated: boolean } => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.user && typeof parsed.isAuthenticated === 'boolean') {
          return {
            user: parsed.user,
            isAuthenticated: parsed.isAuthenticated
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse auth session from localStorage:', e);
    }
    // Default on fresh visit: NOT authenticated, prompt login
    return {
      user: FALLBACK_ADMIN_USER,
      isAuthenticated: false
    };
  };

  const initialAuth = getInitialAuthState();

  // User Management State (Synchronized directly with Database & LocalStorage)
  const [dbUsers, setDbUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User>(initialAuth.user);
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(initialAuth.isAuthenticated);

  const setCurrentUser = useCallback((user: User) => {
    setCurrentUserState(user);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        isAuthenticated: true,
        user
      }));
    } catch (e) {
      console.warn('Failed to save user session to localStorage:', e);
    }
  }, []);

  const registeredUsers = dbUsers.filter(u => u.id.startsWith('usr-reg-'));
  const availableUsers = dbUsers.length > 0 ? dbUsers : (currentUser.id ? [currentUser] : [FALLBACK_ADMIN_USER]);
  const pendingUsers = availableUsers.filter(u => u.approvalStatus === 'PENDING_APPROVAL');
  const pendingUsersCount = pendingUsers.length;

  // Core Data States
  const [departments, setDepartments] = useState<Department[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeInfo[]>([]);
  const [reusableCustomFields, setReusableCustomFields] = useState<ReusableCustomField[]>([]);
  const [bundles, setBundles] = useState<DocumentBundle[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [checkouts, setCheckouts] = useState<CheckoutRecord[]>([]);
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // UI Global state
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<Array<{ id: string; type: 'info' | 'success' | 'warning' | 'error'; message: string; timestamp: string }>>([
    { id: 'n1', type: 'info', message: 'System Ready. Welcome to ArchiveHub PDAMS.', timestamp: 'Just now' }
  ]);

  const addNotification = (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
    const newNotif = {
      id: 'notif-' + Date.now(),
      type,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 9)]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Sync with backend API
  const fetchAllFromBackend = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [deptRes, dtRes, locRes, docRes, chkRes, mvtRes, audRes, healthRes, usersRes, rcfRes, bndlRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/document-types'),
        fetch('/api/locations'),
        fetch('/api/documents'),
        fetch('/api/checkouts'),
        fetch('/api/movements'),
        fetch('/api/audit-logs'),
        fetch('/api/health'),
        fetch('/api/users'),
        fetch('/api/reusable-custom-fields'),
        fetch('/api/bundles')
      ]);

      const protectedResponses = [deptRes, dtRes, locRes, docRes, chkRes, mvtRes, audRes, usersRes, rcfRes, bndlRes];
      if (protectedResponses.some(response => response.status === 401)) {
        setIsAuthenticatedState(false);
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch (error) {
          console.warn('Failed to clear expired session from localStorage:', error);
        }
        addNotification('error', 'Your session has expired. Please sign in again.');
        return;
      }

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (dtRes.ok) setDocumentTypes(await dtRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (docRes.ok) setDocuments(await docRes.json());
      if (chkRes.ok) setCheckouts(await chkRes.json());
      if (mvtRes.ok) setMovements(await mvtRes.json());
      if (audRes.ok) setAuditLogs(await audRes.json());
      if (rcfRes.ok) setReusableCustomFields(await rcfRes.json());
      if (bndlRes.ok) setBundles(await bndlRes.json());
      if (usersRes.ok) {
        const uData = await usersRes.json();
        if (Array.isArray(uData) && uData.length > 0) {
          setDbUsers(uData);
          // Keep current logged-in user refreshed if they exist in updated users list
          try {
            const saved = localStorage.getItem(AUTH_STORAGE_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed && parsed.user && parsed.isAuthenticated) {
                const refreshed = uData.find((u: User) => u.id === parsed.user.id || u.email.toLowerCase() === parsed.user.email?.toLowerCase());
                if (refreshed) {
                  setCurrentUserState(refreshed);
                  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
                    isAuthenticated: true,
                    user: refreshed
                  }));
                }
              }
            }
          } catch (e) {
            console.warn('User session refresh notice:', e);
          }
        }
      }
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setDbHealth(hData.database);
      }
    } catch (err) {
      console.warn('Backend API sync notice:', err);
    }
  }, [isAuthenticated]);

  // Targeted post-mutation refresh: re-fetch only the collections a write can
  // affect. Audit entries are always generated server-side, so 'auditLogs'
  // pulls the authoritative trail instead of fabricating client records.
  const refreshEntities = useCallback(async (...entities: RefreshableEntity[]) => {
    if (!isAuthenticated || entities.length === 0) return;
    const sources: Record<RefreshableEntity, { endpoint: string; apply: (data: any) => void }> = {
      departments: { endpoint: '/api/departments', apply: setDepartments },
      documentTypes: { endpoint: '/api/document-types', apply: setDocumentTypes },
      locations: { endpoint: '/api/locations', apply: setLocations },
      documents: { endpoint: '/api/documents', apply: setDocuments },
      checkouts: { endpoint: '/api/checkouts', apply: setCheckouts },
      movements: { endpoint: '/api/movements', apply: setMovements },
      auditLogs: { endpoint: '/api/audit-logs', apply: setAuditLogs },
      users: {
        endpoint: '/api/users',
        apply: (data) => { if (Array.isArray(data) && data.length > 0) setDbUsers(data); }
      },
      reusableCustomFields: { endpoint: '/api/reusable-custom-fields', apply: setReusableCustomFields },
      bundles: { endpoint: '/api/bundles', apply: setBundles }
    };
    try {
      const unique = Array.from(new Set(entities));
      const responses = await Promise.all(unique.map(e => fetch(sources[e].endpoint)));
      if (responses.some(r => r.status === 401)) {
        setIsAuthenticatedState(false);
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch (error) {
          console.warn('Failed to clear expired session from localStorage:', error);
        }
        addNotification('error', 'Your session has expired. Please sign in again.');
        return;
      }
      await Promise.all(unique.map(async (e, i) => {
        if (responses[i].ok) sources[e].apply(await responses[i].json());
      }));
    } catch (err) {
      console.warn('Targeted refresh notice:', err);
    }
  }, [isAuthenticated]);

  const refreshDbHealth = async (): Promise<DbHealthState> => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setDbHealth(data.database);
      if (data.database?.connected) {
        addNotification('success', 'PostgreSQL Database Connection Active!');
      } else {
        addNotification('warning', `Database Standby: ${data.database?.message || 'Not connected'}. Create .env with Supabase DATABASE_URL to connect.`);
      }
      return data.database;
    } catch (err: any) {
      const fallback: DbHealthState = {
        connected: false,
        message: err?.message || 'Server unreachable',
        timestamp: new Date().toISOString()
      };
      setDbHealth(fallback);
      addNotification('error', `Server health query failed: ${fallback.message}`);
      return fallback;
    }
  };

  const reseedDatabase = async (): Promise<void> => {
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addNotification('success', 'Database seeded successfully.');
        await fetchAllFromBackend();
      } else {
        addNotification('error', `Seeding failed: ${data.error}`);
      }
    } catch (err: any) {
      addNotification('error', `Seeding request error: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchAllFromBackend();
  }, [fetchAllFromBackend]);

  // Auth Operations
  const loginUser = async (email: string, password?: string): Promise<{ success: boolean; message?: string; user?: User; isPendingApproval?: boolean }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsAuthenticatedState(true);
        addNotification('success', `Signed in as ${data.user.fullName} (${data.user.role}).`);
        return { success: true, user: data.user };
      } else {
        return { 
          success: false, 
          message: data.message || 'Login failed.',
          isPendingApproval: data.isPendingApproval 
        };
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Unable to reach the sign-in service.' };
    }
  };

  // --- DATA BACKUP & RESTORE ---
  const exportAllData = async (): Promise<{ success: boolean; message?: string; blob?: Blob }> => {
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message || `Export failed (HTTP ${res.status}).`;
        addNotification('error', msg);
        return { success: false, message: msg };
      }
      const blob = await res.blob();
      return { success: true, blob };
    } catch (e: any) {
      addNotification('error', `Export request failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  };

  // CSV Export - download a single entity type as CSV
  const exportCsv = async (endpoint: string): Promise<{ success: boolean; message?: string; filename?: string }> => {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message || `Export failed (HTTP ${res.status}).`;
        addNotification('error', msg);
        return { success: false, message: msg };
      }
      const blob = await res.blob();
      const timestamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archivehub-${endpoint.split('/').pop()}-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      addNotification('success', `CSV export downloaded: ${link.download}`);
      return { success: true, filename: link.download };
    } catch (e: any) {
      addNotification('error', `CSV export failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  };

  const importAllData = async (payload: any): Promise<{ success: boolean; message?: string; counts?: Record<string, number> }> => {
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        const msg = data?.message || `Import failed (HTTP ${res.status}).`;
        addNotification('error', msg);
        return { success: false, message: msg };
      }
      // Backup replaced the entire database: resync every entity collection.
      await fetchAllFromBackend();
      return { success: true, counts: data.counts };
    } catch (e: any) {
      addNotification('error', `Import request failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  };

  const signupUser = async (userData: Omit<User, 'id'> & { password?: string }): Promise<{ success: boolean; message?: string; user?: User; isPendingApproval?: boolean }> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData,
          approvalStatus: 'PENDING_APPROVAL'
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        // Do NOT log the user in; account is pending approval. The server
        // records the registration in the audit trail.
        addNotification('info', `Registration submitted! Account for ${data.user.fullName} is awaiting Administrator approval.`);
        return { 
          success: true, 
          user: data.user, 
          isPendingApproval: true, 
          message: 'Account registered successfully! Please wait for Administrator approval before signing in.' 
        };
      } else {
        return { success: false, message: data.message || 'Registration failed.' };
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Unable to reach the registration service. Please try again.' };
    }
  };

  const createUser = async (userData: {
    email: string; fullName: string; password?: string; role: string;
    departmentId?: string; departmentName?: string; title?: string; autoApprove?: boolean
  }): Promise<{ success: boolean; message?: string; user?: User; tempPassword?: string }> => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to create user account.');
      await refreshEntities('users', 'auditLogs');
      const tempPassword = data.tempPassword;
      if (data.user) {
        addNotification('success', `Account created for ${data.user.fullName} (${data.user.role}).`);
      }
      return { success: true, message: data.message, user: data.user, tempPassword };
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to create user account.');
      return { success: false, message: e?.message || 'Failed to create user account.' };
    }
  };

  const approveUser = async (userId: string) => {
    const targetUser = availableUsers.find(u => u.id === userId);
    const userName = targetUser ? targetUser.fullName : 'User';
    try {
      const res = await fetch(`/api/users/${userId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to approve user account.');
      addNotification('success', `Approved account for ${userName}. User can now sign in.`);
      await refreshEntities('users', 'auditLogs');
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to approve user account.');
    }
  };

  const rejectUser = async (userId: string) => {
    const targetUser = availableUsers.find(u => u.id === userId);
    const userName = targetUser ? targetUser.fullName : 'User';
    try {
      const res = await fetch(`/api/users/${userId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to reject registration.');
      addNotification('warning', `Registration for ${userName} has been rejected.`);
      await refreshEntities('users', 'auditLogs');
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to reject registration.');
    }
  };

  const updateUserProfile = async (userId: string, updates: Partial<User> & { currentPassword?: string; newPassword?: string }): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = data.message || 'Failed to update profile.';
        addNotification('error', msg);
        return { success: false, message: msg };
      }

      if (data.user) {
        setDbUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
        if (currentUser.id === userId) {
          setCurrentUser({ ...currentUser, ...data.user });
        }
      }

      addNotification('success', 'Your profile has been updated successfully.');
      await refreshEntities('users', 'auditLogs');
      return { success: true };
    } catch (e: any) {
      const msg = e?.message || 'Unable to reach the server. Profile was not updated.';
      addNotification('error', msg);
      return { success: false, message: msg };
    }
  };

  const logoutUser = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(error => {
      console.warn('Could not clear the server session cookie during sign out:', error);
    });
    setIsAuthenticatedState(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear session from localStorage:', e);
    }
    addNotification('info', 'You have signed out of ArchiveHub.');
  };

  const deleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to remove user account.');
      addNotification('info', 'User account removed from database.');
      await refreshEntities('users', 'auditLogs');
      if (currentUser?.id === userId) {
        logoutUser();
      }
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to remove user account.');
    }
  };

  const calculatePath = (locationId: string | null): string => {
    return calculateLocationPath(locations, locationId);
  };

  // Document Types Handlers
  const addDocumentType = async (docTypeData: Omit<DocumentTypeInfo, 'id'>): Promise<DocumentTypeInfo> => {
    try {
      const res = await fetch('/api/document-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docTypeData)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error || 'Failed to create document type.');
      setDocumentTypes(prev => [...prev, data]);
      addNotification('success', `Document Type "${data.name}" added successfully.`);
      return data;
    } catch (err: any) {
      addNotification('error', err?.message || 'Failed to create document type.');
      throw err;
    }
  };

  const updateDocumentType = async (id: string, updates: Partial<DocumentTypeInfo>): Promise<void> => {
    try {
      const res = await fetch(`/api/document-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to update document type.');
      setDocumentTypes(prev => prev.map(dt => dt.id === id ? { ...dt, ...updates } : dt));
      addNotification('info', `Document Type updated.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to update document type.');
    }
  };

  const deleteDocumentType = async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/document-types/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to delete document type.');
      setDocumentTypes(prev => prev.filter(dt => dt.id !== id));
      addNotification('warning', `Document Type deleted.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to delete document type.');
    }
  };

  // Department Handlers
  const addDepartment = async (deptData: Omit<Department, 'id' | 'documentCount'>): Promise<Department | null> => {
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptData)
      });
      const data = await res.json();
      if (!res.ok) {
        addNotification('error', data.error || 'Failed to create department.');
        return null;
      }
      setDepartments(prev => [...prev, data]);
      addNotification('success', `Department "${data.name}" added.`);
      return data;
    } catch (err: any) {
      addNotification('error', err?.message || 'Failed to create department.');
      return null;
    }
  };

  const updateDepartment = async (id: string, updates: Partial<Department>): Promise<void> => {
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to update department.');
      // Department renames propagate into documents, locations, users, types
      // and bundles, so refresh every collection that carries the name.
      await refreshEntities('departments', 'documentTypes', 'documents', 'locations', 'users', 'bundles');
      addNotification('info', `Department updated.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to update department.');
    }
  };

  const deleteDepartment = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to delete department.');
      setDepartments(prev => prev.filter(d => d.id !== id));
      addNotification('warning', `Department deleted.`);
      return true;
    } catch (err: any) {
      addNotification('error', err?.message || 'Failed to delete department.');
      return false;
    }
  };

  // Reusable Custom Field Handlers
  const addReusableCustomField = async (fieldData: Omit<ReusableCustomField, 'id' | 'createdAt'>): Promise<ReusableCustomField> => {
    try {
      const res = await fetch('/api/reusable-custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldData)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error || 'Failed to create reusable field.');
      setReusableCustomFields(prev => [...prev, data]);
      addNotification('success', `Reusable Field "${data.label}" added to library.`);
      return data;
    } catch (err: any) {
      addNotification('error', err?.message || 'Failed to create reusable field.');
      throw err;
    }
  };

  const updateReusableCustomField = async (id: string, updates: Partial<ReusableCustomField>): Promise<void> => {
    try {
      const res = await fetch(`/api/reusable-custom-fields/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to update reusable field.');
      setReusableCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      addNotification('info', `Reusable Field updated.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to update reusable field.');
    }
  };

  const deleteReusableCustomField = async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/reusable-custom-fields/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to delete reusable field.');
      setReusableCustomFields(prev => prev.filter(f => f.id !== id));
      addNotification('warning', `Reusable Field deleted.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to delete reusable field.');
    }
  };

  // Bundle Dossier Handlers
  const addBundle = async (bundleData: Omit<DocumentBundle, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode'>): Promise<DocumentBundle> => {
    try {
      const res = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleData })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error || 'Failed to create bundle dossier.');
      await refreshEntities('bundles', 'documents', 'auditLogs');
      addNotification('success', `Bundle dossier "${data.bundleNumber} - ${data.title}" created.`);
      return data;
    } catch (err: any) {
      addNotification('error', err?.message || 'Failed to create bundle dossier.');
      throw err;
    }
  };

  const updateBundle = async (id: string, updates: Partial<DocumentBundle>): Promise<void> => {
    try {
      const res = await fetch(`/api/bundles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to update bundle.');
      await refreshEntities('bundles', 'documents', 'auditLogs');
      addNotification('info', `Bundle updated.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to update bundle.');
    }
  };

  const deleteBundle = async (id: string): Promise<void> => {
    const target = bundles.find(b => b.id === id);
    try {
      const res = await fetch(`/api/bundles/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to dissolve bundle.');
      await refreshEntities('bundles', 'documents', 'auditLogs');
      addNotification('warning', `Bundle dossier "${target?.bundleNumber || id}" dissolved.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to dissolve bundle.');
    }
  };

  const addDocumentsToBundle = async (bundleId: string, docIds: string[]): Promise<void> => {
    const target = bundles.find(b => b.id === bundleId);
    if (!target) return;
    try {
      const res = await fetch(`/api/bundles/${bundleId}/add-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: docIds })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to add documents to bundle.');
      await refreshEntities('bundles', 'documents', 'auditLogs');
      addNotification('success', `Added ${docIds.length} document(s) to bundle "${target.bundleNumber}".`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to add documents to bundle.');
    }
  };

  const removeDocumentFromBundle = async (bundleId: string, docId: string): Promise<void> => {
    try {
      const res = await fetch(`/api/bundles/${bundleId}/remove-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to remove document from bundle.');
      await refreshEntities('bundles', 'documents', 'auditLogs');
      addNotification('info', `Removed document from bundle.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to remove document from bundle.');
    }
  };

  // Location Handlers
  const addLocation = async (locData: Omit<LocationItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'currentOccupancy'>): Promise<LocationItem> => {
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locData)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error || 'Failed to create physical location.');
      setLocations(prev => [...prev, data]);
      addNotification('success', `Physical location '${data.name}' created successfully.`);
      return data;
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to create physical location.');
      throw e;
    }
  };

  const updateLocation = async (id: string, updates: Partial<LocationItem>): Promise<void> => {
    try {
      const res = await fetch(`/api/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to update location.');
      await refreshEntities('locations', 'documents');
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to update location.');
    }
  };

  const deleteLocation = async (id: string): Promise<boolean> => {
    const hasChildren = locations.some(l => l.parentId === id);
    const hasDocs = documents.some(d => d.homeLocationId === id || d.currentLocationId === id);

    if (hasChildren || hasDocs) {
      addNotification('error', 'Cannot delete location: it still contains sub-locations or documents.');
      return false;
    }

    const locToDelete = locations.find(l => l.id === id);
    try {
      const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to delete location.');
      setLocations(prev => prev.filter(l => l.id !== id));
      if (locToDelete) {
        addNotification('info', `Location '${locToDelete.name}' deleted.`);
      }
      return true;
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to delete location.');
      return false;
    }
  };

  // Document Handlers
  const addDocument = async (docData: NewDocumentItem): Promise<DocumentItem> => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docData })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Document registration failed (HTTP ${res.status}).`);
      }
      const newDoc = data as DocumentItem;
      if (!newDoc?.id || !newDoc.documentNumber) {
        throw new Error('The server did not return a valid saved document.');
      }
      setDocuments(prev => [newDoc, ...prev]);
      // E7/T-07: trust the server-returned record instead of re-downloading the
      // whole catalogue on every save (the save path must stay fast at high
      // intake volume). The server recomputes occupancy in the same transaction;
      // mirror that locally for the filing location. Audit/movement views pick
      // up their new entries on the next entity refresh.
      setLocations(prev => prev.map(loc =>
        loc.id === newDoc.currentLocationId
          ? { ...loc, currentOccupancy: (loc.currentOccupancy ?? 0) + 1 }
          : loc
      ));
      addNotification('success', `Document #${newDoc.documentNumber} registered successfully.`);
      return newDoc;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document registration failed.';
      addNotification('error', message);
      throw error;
    }
  };

  // Preview the next structured number ({DEPT_CODE}-{TYPE_CODE}-{NNNN}) for a
  // department + document type pair — used by the registration form hint.
  const getNextDocumentNumber = async (departmentId: string, typeId: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/documents/next-number?departmentId=${encodeURIComponent(departmentId)}&typeId=${encodeURIComponent(typeId)}`);
      const data = await res.json();
      return res.ok ? data.number : null;
    } catch (e) {
      return null;
    }
  };

  const updateDocument = async (id: string, updates: Partial<DocumentItem>): Promise<void> => {
    const doc = documents.find(d => d.id === id);
    const docNum = doc?.documentNumber || updates.documentNumber || id;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || `Document update failed (HTTP ${res.status}).`);
      }

      setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d));
      await refreshEntities('documents', 'bundles', 'locations', 'auditLogs');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document update failed.';
      addNotification('error', message);
      throw error;
    }

    addNotification('success', `Document #${docNum} updated successfully.`);
  };

  const uploadDigitalCopy = async (id: string, file: File, version?: number): Promise<{ success: boolean; message?: string }> => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return { success: false, message: 'Document not found.' };

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/documents/${id}/digital-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileData: dataUrl,
          fileType: file.type || 'application/octet-stream',
          version: version || (doc.digitalFileVersion || 1)
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.error || 'Digital copy upload failed.' };
      }

      const appliedVersion = Number(version) || doc.digitalFileVersion || 1;
      setDocuments(prev => prev.map(d => d.id === id ? {
        ...d,
        hasDigitalCopy: true,
        digitalFileName: data.fileName,
        digitalFileSize: data.sizeLabel,
        digitalFileType: file.type || 'application/octet-stream',
        digitalFileVersion: appliedVersion,
        digitalFilePath: data.relativePath,
        updatedAt: new Date().toISOString()
      } : d));

      await refreshEntities('documents', 'auditLogs');
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Digital copy upload failed.' };
    }
  };

  const deleteDocument = async (id: string): Promise<boolean> => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return false;
    if (doc.status === 'CHECKED_OUT') {
      addNotification('error', `Cannot delete record #${doc.documentNumber} while it is checked out.`);
      return false;
    }

    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to delete document.');
      setDocuments(prev => prev.filter(d => d.id !== id));
      addNotification('warning', `Record #${doc.documentNumber} deleted.`);
      await refreshEntities('documents', 'locations', 'auditLogs');
      return true;
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to delete document.');
      return false;
    }
  };

  // Bulk Update — apply one metadata change (security/condition/department)
  // to every selected record in a single server-side transaction.
  const bulkUpdateDocuments = async (documentIds: string[], updates: Partial<DocumentItem>): Promise<{ updated: number; errors: string[] }> => {
    try {
      const res = await fetch('/api/documents/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds, updates })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Bulk update failed.');
      await refreshEntities('documents', 'auditLogs');
      const errors: string[] = data.errors || [];
      if (errors.length > 0) {
        addNotification('warning', `Bulk update applied to ${data.updated} of ${documentIds.length} record(s).`);
      } else {
        addNotification('success', `${data.updated ?? documentIds.length} record(s) updated.`);
      }
      return { updated: data.updated ?? documentIds.length, errors };
    } catch (e: any) {
      const msg = e?.message || 'Bulk update failed.';
      addNotification('error', msg);
      return { updated: 0, errors: [msg] };
    }
  };

  // Bulk Delete — remove every selected record (checked-out ones are blocked)
  const bulkDeleteDocuments = async (documentIds: string[]): Promise<{ deleted: number; skipped: { id: string; reason: string }[] }> => {
    const checkedOut = documents.filter(d => documentIds.includes(d.id) && d.status === 'CHECKED_OUT');
    const deletableIds = documentIds.filter(id => !checkedOut.some(d => d.id === id));
    const skipped: { id: string; reason: string }[] = checkedOut.map(d => ({ id: d.id, reason: `#${d.documentNumber} is currently checked out` }));
    if (checkedOut.length > 0) {
      addNotification('error', `${checkedOut.length} record(s) are checked out and cannot be deleted.`);
    }
    if (deletableIds.length === 0) {
      return { deleted: 0, skipped };
    }

    try {
      const res = await fetch('/api/documents/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: deletableIds })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Bulk delete failed.');
      await refreshEntities('documents', 'locations', 'auditLogs');
      const serverSkipped = data.skipped || [];
      addNotification('warning', `${data.deleted ?? deletableIds.length} record(s) deleted from the registry.`);
      return { deleted: data.deleted ?? deletableIds.length, skipped: [...skipped, ...serverSkipped] };
    } catch (e: any) {
      const msg = e?.message || 'Bulk delete failed.';
      addNotification('error', msg);
      return { deleted: 0, skipped };
    }
  };

  const moveDocument = async (documentId: string, toLocationId: string, reason: string): Promise<void> => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toLocationId, reason })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Relocation failed.');
      await refreshEntities('documents', 'movements', 'locations', 'auditLogs');
      addNotification('info', `Record #${doc.documentNumber} relocated to new storage position.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Relocation failed.');
    }
  };

  const batchMoveDocuments = async (documentIds: string[], toLocationId: string, reason: string): Promise<{ moved: number; errors: Array<{ id: string; reason: string }> }> => {
    const toPath = calculatePath(toLocationId);
    try {
      const res = await fetch('/api/documents/batch-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds, toLocationId, reason: reason || 'Batch Relocation Transfer' })
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || 'Batch relocation failed.');
      await refreshEntities('documents', 'movements', 'locations', 'auditLogs');
      const movedCount = result.moved ?? documentIds.length;
      const errors = result.errors || [];
      if (errors.length > 0) {
        addNotification('warning', `Batch relocated ${movedCount} document(s) to ${toPath}. ${errors.length} item(s) could not be moved.`);
      } else {
        addNotification('success', `Batch relocated ${movedCount} document(s) to ${toPath}.`);
      }
      return { moved: movedCount, errors };
    } catch (e: any) {
      addNotification('error', e?.message || 'Batch relocation failed.');
      return { moved: 0, errors: documentIds.map(id => ({ id, reason: e?.message || 'Batch relocation failed.' })) };
    }
  };

  // QR Code Claim Operations
  const claimDocumentQr = async (documentId: string): Promise<{ success: boolean; message?: string; claimedAt?: string }> => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return { success: false, message: 'Document not found.' };

    try {
      const res = await fetch(`/api/documents/${documentId}/qr-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        const message = result?.message || result?.error || 'Failed to claim QR code.';
        addNotification('error', message);
        return { success: false, message };
      }
      await refreshEntities('documents', 'auditLogs');
      addNotification('success', `QR code claimed for document #${doc.documentNumber}.`);
      return { success: true, message: result.message, claimedAt: result.claimedAt || new Date().toISOString() };
    } catch (e: any) {
      const message = e?.message || 'Failed to claim QR code.';
      addNotification('error', message);
      return { success: false, message };
    }
  };

  const unclaimDocumentQr = async (documentId: string): Promise<{ success: boolean; message?: string }> => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return { success: false, message: 'Document not found.' };
    if (!doc.qrClaimed) return { success: false, message: 'QR code is not currently claimed.' };

    try {
      const res = await fetch(`/api/documents/${documentId}/qr-unclaim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        const message = result?.message || result?.error || 'Failed to unclaim QR code.';
        addNotification('error', message);
        return { success: false, message };
      }
      await refreshEntities('documents', 'auditLogs');
      addNotification('success', `QR code claim reset for document #${doc.documentNumber}.`);
      return { success: true, message: result.message };
    } catch (e: any) {
      const message = e?.message || 'Failed to unclaim QR code.';
      addNotification('error', message);
      return { success: false, message };
    }
  };


  // Checkout Operations
  const requestCheckout = async (documentId: string, purpose: string, dueDate: string): Promise<CheckoutRecord> => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) throw new Error('Document not found');

    try {
      const res = await fetch('/api/checkouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, purpose, dueDate })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.error || 'Failed to submit borrow request.');
      await refreshEntities('checkouts', 'documents', 'auditLogs');
      addNotification('info', `Borrow request submitted for Document #${doc.documentNumber}`);
      return data;
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to submit borrow request.');
      throw e;
    }
  };

  const approveCheckout = async (checkoutId: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;

    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to approve borrow request.');
      await refreshEntities('checkouts', 'documents', 'auditLogs');
      addNotification('success', `Borrow request for #${chk.documentNumber} approved.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to approve borrow request.');
    }
  };

  const rejectCheckout = async (checkoutId: string, reason: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;

    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to reject borrow request.');
      await refreshEntities('checkouts', 'documents', 'auditLogs');
      addNotification('warning', `Request for #${chk.documentNumber} rejected.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to reject borrow request.');
    }
  };

  const processCheckoutDispatch = async (checkoutId: string, tempLocationId: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;
    const doc = documents.find(d => d.id === chk.documentId);
    if (!doc) return;

    if (!tempLocationId) {
      addNotification('error', 'A staging location is required to release the loan.');
      return;
    }

    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempLocationId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to dispatch checkout.');
      await refreshEntities('checkouts', 'documents', 'movements', 'locations', 'auditLogs');
      addNotification('success', `Document #${doc.documentNumber} checked out successfully.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to dispatch checkout.');
    }
  };

  const processCheckInReturn = async (checkoutId: string, conditionIn: DocumentItem['condition'], returnLocationId: string, notes?: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;
    const doc = documents.find(d => d.id === chk.documentId);
    if (!doc) return;

    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionIn, returnLocationId, notes })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to process return.');
      await refreshEntities('checkouts', 'documents', 'movements', 'locations', 'auditLogs');
      addNotification('success', `Document #${doc.documentNumber} returned to archive location.`);
    } catch (e: any) {
      addNotification('error', e?.message || 'Failed to process return.');
    }
  };

  const lookupByQR = (qrString: string) => {
    const cleanQR = qrString.trim().toLowerCase();
    const foundDoc = documents.find(d => 
      d.qrCode.toLowerCase() === cleanQR || 
      d.documentNumber.toLowerCase() === cleanQR || 
      d.barcode.toLowerCase() === cleanQR
    );
    if (foundDoc) return { type: 'DOCUMENT' as const, data: foundDoc };

    const foundBundle = bundles.find(b =>
      b.qrCode.toLowerCase() === cleanQR ||
      b.bundleNumber.toLowerCase() === cleanQR ||
      b.barcode.toLowerCase() === cleanQR
    );
    if (foundBundle) return { type: 'BUNDLE' as const, data: foundBundle };

    const foundLoc = locations.find(l => 
      l.qrCode.toLowerCase() === cleanQR || 
      l.code.toLowerCase() === cleanQR || 
      l.barcode.toLowerCase() === cleanQR ||
      l.name.toLowerCase() === cleanQR
    );
    if (foundLoc) return { type: 'LOCATION' as const, data: foundLoc };

    return null;
  };

  // Remote scan lookup fallback: resolves codes the local cache does not know
  // (e.g. records registered on another workstation) via the server, which
  // also enforces confidentiality on the matched record.
  const lookupByQRRemote = async (code: string): Promise<{ type: 'DOCUMENT' | 'LOCATION' | 'BUNDLE'; data: DocumentItem | LocationItem | DocumentBundle } | null> => {
    try {
      const res = await fetch(`/api/lookup?code=${encodeURIComponent(code.trim())}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.type === 'document' && data.item) return { type: 'DOCUMENT', data: data.item };
      if (data?.type === 'bundle' && data.item) return { type: 'BUNDLE', data: data.item };
      if (data?.type === 'location' && data.item) return { type: 'LOCATION', data: data.item };
      return null;
    } catch {
      return null;
    }
  };

  return (
    <ArchiveContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated,
        registeredUsers,
        availableUsers,
        pendingUsers,
        pendingUsersCount,
        loginUser,
        signupUser,
        createUser,
        logoutUser,
        approveUser,
        rejectUser,
        deleteUser,
        updateUserProfile,
        exportAllData,
        exportCsv,
        importAllData,
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
        bundles,
        addBundle,
        updateBundle,
        deleteBundle,
        addDocumentsToBundle,
        removeDocumentFromBundle,
        locations,
        documents,
        checkouts,
        movements,
        auditLogs,
        globalSearchQuery,
        setGlobalSearchQuery,
        activeTab,
        setActiveTab,
        addLocation,
        updateLocation,
        deleteLocation,
        addDocument,
        getNextDocumentNumber,
        updateDocument,
        uploadDigitalCopy,
        deleteDocument,
        bulkUpdateDocuments,
        bulkDeleteDocuments,
        moveDocument,
        batchMoveDocuments,
        claimDocumentQr,
        unclaimDocumentQr,
        requestCheckout,
        approveCheckout,
        rejectCheckout,
        processCheckoutDispatch,
        processCheckInReturn,
        lookupByQR,
        lookupByQRRemote,
        calculatePath,
        notifications,
        addNotification,
        dismissNotification,
        dbHealth,
        refreshDbHealth,
        reseedDatabase
      }}
    >
      {children}
    </ArchiveContext.Provider>
  );
};

export const useArchive = () => {
  const context = useContext(ArchiveContext);
  if (!context) {
    throw new Error('useArchive must be used within an ArchiveProvider');
  }
  return context;
};
