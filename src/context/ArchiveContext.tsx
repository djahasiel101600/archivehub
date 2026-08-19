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
  DocumentBundle
} from '../types';
import { calculateLocationPath } from '../utils/locationUtils';

export interface DbHealthState {
  connected: boolean;
  message: string;
  timestamp: string;
}

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
  logoutUser: () => void;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => void;
  updateUserProfile: (userId: string, updates: Partial<User> & { currentPassword?: string; newPassword?: string }) => Promise<{ success: boolean; message?: string }>;

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
  addDocument: (doc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'status' | 'currentLocationId'>) => Promise<DocumentItem>;
  updateDocument: (id: string, updates: Partial<DocumentItem>) => Promise<void>;
  deleteDocument: (id: string) => Promise<boolean>;
  moveDocument: (documentId: string, toLocationId: string, reason: string) => Promise<void>;
  batchMoveDocuments: (documentIds: string[], toLocationId: string, reason: string) => Promise<void>;
  
  // Checkout & Return Operations
  requestCheckout: (documentId: string, purpose: string, dueDate: string) => Promise<CheckoutRecord>;
  approveCheckout: (checkoutId: string) => Promise<void>;
  rejectCheckout: (checkoutId: string, reason: string) => Promise<void>;
  processCheckoutDispatch: (checkoutId: string, tempLocationId?: string) => Promise<void>;
  processCheckInReturn: (checkoutId: string, conditionIn: DocumentItem['condition'], returnLocationId: string, notes?: string) => Promise<void>;
  
  // Helper Lookups
  lookupByQR: (qrString: string) => { type: 'DOCUMENT' | 'LOCATION' | 'BUNDLE'; data: DocumentItem | LocationItem | DocumentBundle } | null;
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
  }, []);

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
      // Fallback in case of network / offline
      const cleanEmail = email.trim().toLowerCase();
      const foundUser = availableUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (!foundUser) return { success: false, message: 'No account found with this email address.' };
      
      if (foundUser.approvalStatus === 'PENDING_APPROVAL') {
        return { 
          success: false, 
          isPendingApproval: true,
          message: 'Your account is pending Administrator approval. Please wait for an Admin to activate your account.' 
        };
      }

      if (foundUser.approvalStatus === 'REJECTED') {
        return { 
          success: false, 
          message: 'Your account access request was rejected by an Administrator.' 
        };
      }

      if (foundUser.password && password && foundUser.password !== password) {
        return { success: false, message: 'Incorrect password provided.' };
      }

      setCurrentUser(foundUser);
      setIsAuthenticatedState(true);
      addNotification('success', `Signed in as ${foundUser.fullName} (${foundUser.role}).`);
      return { success: true, user: foundUser };
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
        // Do NOT log the user in; account is pending approval
        await fetchAllFromBackend();
        
        // Add audit trail for new registration
        const logId = 'log-' + Date.now();
        const newLog: AuditLogRecord = {
          id: logId,
          timestamp: new Date().toISOString(),
          userId: data.user.id,
          userName: data.user.fullName,
          userRole: data.user.role,
          action: 'USER_LOGIN',
          details: `User account registered for ${data.user.fullName} (${data.user.email}) - Status: PENDING_APPROVAL.`,
          entityType: 'USER',
          entityId: data.user.id,
          entityName: data.user.fullName,
          ipAddress: '127.0.0.1'
        };
        setAuditLogs(prev => [newLog, ...prev]);
        
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
      const cleanEmail = userData.email.trim().toLowerCase();
      if (availableUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
        return { success: false, message: 'An account with this email address already exists.' };
      }
      const newUser: User = {
        ...userData,
        id: 'usr-reg-' + Date.now(),
        email: cleanEmail,
        approvalStatus: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString()
      };
      setDbUsers(prev => [...prev, newUser]);
      
      addNotification('info', `Registration submitted! Account for ${newUser.fullName} is awaiting Administrator approval.`);
      return { 
        success: true, 
        user: newUser, 
        isPendingApproval: true, 
        message: 'Account registered successfully! Please wait for Administrator approval before signing in.' 
      };
    }
  };

  const approveUser = async (userId: string) => {
    try {
      await fetch(`/api/users/${userId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      setDbUsers(prev => prev.map(u => u.id === userId ? { ...u, approvalStatus: 'APPROVED' } : u));
      
      const targetUser = availableUsers.find(u => u.id === userId);
      const userName = targetUser ? targetUser.fullName : 'User';
      
      // Audit log
      const logId = 'log-' + Date.now();
      const newLog: AuditLogRecord = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'METADATA_UPDATE',
        details: `Approved user registration for ${userName} (${userId}).`,
        entityType: 'USER',
        entityId: userId,
        entityName: userName,
        ipAddress: '127.0.0.1'
      };
      setAuditLogs(prev => [newLog, ...prev]);

      addNotification('success', `Approved account for ${userName}. User can now sign in.`);
      await fetchAllFromBackend();
    } catch (e) {
      setDbUsers(prev => prev.map(u => u.id === userId ? { ...u, approvalStatus: 'APPROVED' } : u));
      addNotification('success', 'User account approved.');
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      await fetch(`/api/users/${userId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' })
      });
      setDbUsers(prev => prev.map(u => u.id === userId ? { ...u, approvalStatus: 'REJECTED' } : u));
      
      const targetUser = availableUsers.find(u => u.id === userId);
      const userName = targetUser ? targetUser.fullName : 'User';
      
      // Audit log
      const logId = 'log-' + Date.now();
      const newLog: AuditLogRecord = {
        id: logId,
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'METADATA_UPDATE',
        details: `Rejected registration for ${userName} (${userId}).`,
        entityType: 'USER',
        entityId: userId,
        entityName: userName,
        ipAddress: '127.0.0.1'
      };
      setAuditLogs(prev => [newLog, ...prev]);

      addNotification('warning', `Registration for ${userName} has been rejected.`);
      await fetchAllFromBackend();
    } catch (e) {
      setDbUsers(prev => prev.map(u => u.id === userId ? { ...u, approvalStatus: 'REJECTED' } : u));
      addNotification('warning', 'User registration rejected.');
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
      await fetchAllFromBackend();
      return { success: true };
    } catch (e: any) {
      // Offline fallback: apply locally (password changes cannot be applied offline)
      const { currentPassword: _cp, newPassword: _np, ...localFields } = updates;
      setDbUsers(prev => prev.map(u => u.id === userId ? { ...u, ...localFields } : u));
      if (currentUser.id === userId) {
        setCurrentUser({ ...currentUser, ...localFields });
      }
      addNotification(_np ? 'warning' : 'success', _np ? 'Server unreachable: profile fields updated locally, but the password change was not applied.' : 'Server unreachable: profile updated locally.');
      return { success: true };
    }
  };

  const logoutUser = () => {
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
      await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      addNotification('info', 'User account removed from database.');
      await fetchAllFromBackend();
    } catch (e) {
      setDbUsers(prev => prev.filter(u => u.id !== userId));
      addNotification('info', 'User account removed.');
    }
    if (currentUser?.id === userId) {
      logoutUser();
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
      const newType = await res.json();
      setDocumentTypes(prev => [...prev, newType]);
      addNotification('success', `Document Type "${newType.name}" added successfully.`);
      return newType;
    } catch (err) {
      const newDocType: DocumentTypeInfo = { ...docTypeData, id: `dt-${Date.now()}` };
      setDocumentTypes(prev => [...prev, newDocType]);
      addNotification('success', `Document Type "${newDocType.name}" added.`);
      return newDocType;
    }
  };

  const updateDocumentType = async (id: string, updates: Partial<DocumentTypeInfo>): Promise<void> => {
    setDocumentTypes(prev => prev.map(dt => dt.id === id ? { ...dt, ...updates } : dt));
    try {
      await fetch(`/api/document-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {}
    addNotification('info', `Document Type updated.`);
  };

  const deleteDocumentType = async (id: string): Promise<void> => {
    setDocumentTypes(prev => prev.filter(dt => dt.id !== id));
    try {
      await fetch(`/api/document-types/${id}`, { method: 'DELETE' });
    } catch (e) {}
    addNotification('warning', `Document Type deleted.`);
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
    } catch (err) {
      const newDept: Department = { ...deptData, id: `dept-${Date.now()}`, documentCount: 0 };
      setDepartments(prev => [...prev, newDept]);
      addNotification('success', `Department "${newDept.name}" added.`);
      return newDept;
    }
  };

  const updateDepartment = async (id: string, updates: Partial<Department>): Promise<void> => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    try {
      await fetch(`/api/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      // Refresh related records so propagated department names stay in sync
      await fetchAllFromBackend();
    } catch (e) {}
    addNotification('info', `Department updated.`);
  };

  const deleteDepartment = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addNotification('error', data.error || 'Failed to delete department.');
        return false;
      }
      setDepartments(prev => prev.filter(d => d.id !== id));
      addNotification('warning', `Department deleted.`);
      return true;
    } catch (err) {
      setDepartments(prev => prev.filter(d => d.id !== id));
      addNotification('warning', `Department deleted.`);
      return true;
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
      const newField = await res.json();
      setReusableCustomFields(prev => [...prev, newField]);
      addNotification('success', `Reusable Field "${newField.label}" added to library.`);
      return newField;
    } catch (err) {
      const newField: ReusableCustomField = {
        ...fieldData,
        id: `rcf-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      setReusableCustomFields(prev => [...prev, newField]);
      addNotification('success', `Reusable Field "${newField.label}" added.`);
      return newField;
    }
  };

  const updateReusableCustomField = async (id: string, updates: Partial<ReusableCustomField>): Promise<void> => {
    setReusableCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    try {
      await fetch(`/api/reusable-custom-fields/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {}
    addNotification('info', `Reusable Field updated.`);
  };

  const deleteReusableCustomField = async (id: string): Promise<void> => {
    setReusableCustomFields(prev => prev.filter(f => f.id !== id));
    try {
      await fetch(`/api/reusable-custom-fields/${id}`, { method: 'DELETE' });
    } catch (e) {}
    addNotification('warning', `Reusable Field deleted.`);
  };

  // Bundle Dossier Handlers
  const addBundle = async (bundleData: Omit<DocumentBundle, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode'>): Promise<DocumentBundle> => {
    try {
      const res = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleData, user: currentUser })
      });
      const newBundle = await res.json();
      setBundles(prev => [newBundle, ...prev]);
      await fetchAllFromBackend();
      addNotification('success', `Bundle dossier "${newBundle.bundleNumber} - ${newBundle.title}" created.`);
      return newBundle;
    } catch (err) {
      const id = `bndl-${Date.now()}`;
      const now = new Date().toISOString();
      const newBundle: DocumentBundle = {
        ...bundleData,
        id,
        qrCode: 'BNDL-' + bundleData.bundleNumber,
        barcode: '889' + Math.floor(100000 + Math.random() * 900000),
        createdAt: now,
        updatedAt: now
      };
      setBundles(prev => [newBundle, ...prev]);
      if (newBundle.documentIds && newBundle.documentIds.length > 0) {
        setDocuments(prev => prev.map(d => newBundle.documentIds.includes(d.id) ? { ...d, bundleId: newBundle.id, bundleNumber: newBundle.bundleNumber, bundleTitle: newBundle.title } : d));
      }
      addNotification('success', `Bundle dossier "${newBundle.bundleNumber}" created.`);
      return newBundle;
    }
  };

  const updateBundle = async (id: string, updates: Partial<DocumentBundle>): Promise<void> => {
    setBundles(prev => prev.map(b => b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b));
    try {
      await fetch(`/api/bundles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, user: currentUser })
      });
    } catch (e) {}
    addNotification('info', `Bundle updated.`);
  };

  const deleteBundle = async (id: string): Promise<void> => {
    const target = bundles.find(b => b.id === id);
    setBundles(prev => prev.filter(b => b.id !== id));
    setDocuments(prev => prev.map(d => d.bundleId === id ? { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined } : d));
    try {
      await fetch(`/api/bundles/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser })
      });
    } catch (e) {}
    addNotification('warning', `Bundle dossier "${target?.bundleNumber || id}" dissolved.`);
  };

  const addDocumentsToBundle = async (bundleId: string, docIds: string[]): Promise<void> => {
    const target = bundles.find(b => b.id === bundleId);
    if (!target) return;
    const newDocIds = Array.from(new Set([...target.documentIds, ...docIds]));
    setBundles(prev => prev.map(b => b.id === bundleId ? { ...b, documentIds: newDocIds, updatedAt: new Date().toISOString() } : b));
    setDocuments(prev => prev.map(d => docIds.includes(d.id) ? { ...d, bundleId: target.id, bundleNumber: target.bundleNumber, bundleTitle: target.title } : d));
    try {
      await fetch(`/api/bundles/${bundleId}/add-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: docIds, user: currentUser })
      });
    } catch (e) {}
    addNotification('success', `Added ${docIds.length} document(s) to bundle "${target.bundleNumber}".`);
  };

  const removeDocumentFromBundle = async (bundleId: string, docId: string): Promise<void> => {
    setBundles(prev => prev.map(b => b.id === bundleId ? { ...b, documentIds: b.documentIds.filter(id => id !== docId), updatedAt: new Date().toISOString() } : b));
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined } : d));
    try {
      await fetch(`/api/bundles/${bundleId}/remove-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, user: currentUser })
      });
    } catch (e) {}
    addNotification('info', `Removed document from bundle.`);
  };

  // Location Handlers
  const addLocation = async (locData: Omit<LocationItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'currentOccupancy'>): Promise<LocationItem> => {
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locData)
      });
      const newLoc = await res.json();
      setLocations(prev => [...prev, newLoc]);
      addNotification('success', `Physical location '${newLoc.name}' created successfully.`);
      return newLoc;
    } catch (e) {
      const id = 'loc-' + locData.type.toLowerCase() + '-' + Date.now();
      const code = locData.code || locData.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
      const newLoc: LocationItem = {
        ...locData, id, code, capacity: locData.capacity || 20, currentOccupancy: 0,
        qrCode: 'LOC-' + code, barcode: '' + (Math.floor(1000000 + Math.random() * 9000000)),
        createdAt: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString().split('T')[0]
      };
      setLocations(prev => [...prev, newLoc]);
      addNotification('success', `Physical location '${newLoc.name}' created successfully.`);
      return newLoc;
    }
  };

  const updateLocation = async (id: string, updates: Partial<LocationItem>): Promise<void> => {
    setLocations(prev => prev.map(loc => loc.id === id ? { ...loc, ...updates, updatedAt: new Date().toISOString().split('T')[0] } : loc));
    try {
      await fetch(`/api/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {}
  };

  const deleteLocation = async (id: string): Promise<boolean> => {
    const hasChildren = locations.some(l => l.parentId === id);
    const hasDocs = documents.some(d => d.homeLocationId === id || d.currentLocationId === id);

    if (hasChildren || hasDocs) {
      addNotification('error', 'Cannot delete location: it still contains sub-locations or documents.');
      return false;
    }

    const locToDelete = locations.find(l => l.id === id);
    setLocations(prev => prev.filter(l => l.id !== id));

    try {
      await fetch(`/api/locations/${id}`, { method: 'DELETE' });
    } catch (e) {}

    if (locToDelete) {
      addNotification('info', `Location '${locToDelete.name}' deleted.`);
    }
    return true;
  };

  // Document Handlers
  const addDocument = async (docData: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'status' | 'currentLocationId'>): Promise<DocumentItem> => {
    const homePath = calculatePath(docData.homeLocationId);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docData, user: currentUser, homePath })
      });
      const newDoc = await res.json();
      setDocuments(prev => [newDoc, ...prev]);
      await fetchAllFromBackend();
      addNotification('success', `Document #${newDoc.documentNumber} registered successfully.`);
      return newDoc;
    } catch (e) {
      const id = 'doc-' + Date.now();
      const qrCode = 'DOC-' + docData.documentNumber;
      const barcode = '884' + Math.floor(100000 + Math.random() * 900000);
      const newDoc: DocumentItem = {
        ...docData, id, currentLocationId: docData.homeLocationId, status: 'AVAILABLE',
        qrCode, barcode, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      setDocuments(prev => [newDoc, ...prev]);
      addNotification('success', `Document #${newDoc.documentNumber} registered successfully.`);
      return newDoc;
    }
  };

  const updateDocument = async (id: string, updates: Partial<DocumentItem>): Promise<void> => {
    const doc = documents.find(d => d.id === id);
    const docNum = doc?.documentNumber || updates.documentNumber || id;
    
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d));
    
    // Add local audit entry for immediate feedback
    const auditRecord: AuditLogRecord = {
      id: 'aud-' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'DOCUMENT_UPDATED',
      entityType: 'DOCUMENT',
      entityId: id,
      entityName: updates.title || doc?.title || 'Document Record',
      timestamp: new Date().toISOString(),
      details: `Updated metadata and attributes for document #${docNum}`
    };
    setAuditLogs(prev => [auditRecord, ...prev]);

    try {
      await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, user: currentUser })
      });
      fetchAllFromBackend();
    } catch (e) {}
    
    addNotification('success', `Document #${docNum} updated successfully.`);
  };

  const deleteDocument = async (id: string): Promise<boolean> => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return false;
    if (doc.status === 'CHECKED_OUT') {
      addNotification('error', `Cannot delete record #${doc.documentNumber} while it is checked out.`);
      return false;
    }

    setDocuments(prev => prev.filter(d => d.id !== id));
    try {
      await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser })
      });
    } catch (e) {}
    addNotification('warning', `Record #${doc.documentNumber} deleted.`);
    return true;
  };

  const moveDocument = async (documentId: string, toLocationId: string, reason: string): Promise<void> => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;

    const fromLocId = doc.currentLocationId;
    const fromPath = calculatePath(fromLocId);
    const toPath = calculatePath(toLocationId);

    setDocuments(prev => prev.map(d => d.id === documentId ? { ...d, currentLocationId: toLocationId, updatedAt: new Date().toISOString() } : d));

    try {
      await fetch(`/api/documents/${documentId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toLocationId, reason, user: currentUser, fromPath, toPath })
      });
      await fetchAllFromBackend();
    } catch (e) {}

    addNotification('info', `Record #${doc.documentNumber} relocated to new storage position.`);
  };

  const batchMoveDocuments = async (documentIds: string[], toLocationId: string, reason: string): Promise<void> => {
    const toPath = calculatePath(toLocationId);
    const fromPaths: Record<string, string> = {};
    documentIds.forEach(id => {
      const doc = documents.find(d => d.id === id);
      fromPaths[id] = doc ? calculatePath(doc.currentLocationId) : 'Unknown';
    });

    // Optimistic update
    setDocuments(prev => prev.map(d => documentIds.includes(d.id) ? { ...d, currentLocationId: toLocationId, updatedAt: new Date().toISOString() } : d));

    try {
      const res = await fetch('/api/documents/batch-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds, toLocationId, reason: reason || 'Batch Relocation Transfer', user: currentUser, fromPaths, toPath })
      });
      const result = await res.json();
      await fetchAllFromBackend();
      const movedCount = result.moved ?? documentIds.length;
      addNotification('success', `Batch relocated ${movedCount} document(s) to ${toPath}.`);
    } catch (e) {
      addNotification('warning', `Batch relocation completed (offline mode). ${documentIds.length} document(s) updated locally.`);
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
        body: JSON.stringify({ documentId, purpose, dueDate, user: currentUser })
      });
      const chk = await res.json();
      setCheckouts(prev => [chk, ...prev]);
      setDocuments(prev => prev.map(d => d.id === documentId ? { ...d, status: 'REQUESTED' } : d));
      addNotification('info', `Borrow request submitted for Document #${doc.documentNumber}`);
      return chk;
    } catch (e) {
      const newChk: CheckoutRecord = {
        id: 'chk-' + Date.now(), documentId, documentNumber: doc.documentNumber, documentTitle: doc.title,
        requestedByUserId: currentUser.id, requestedByUserName: currentUser.fullName, requestedByDepartment: currentUser.departmentName,
        requestDate: new Date().toISOString().split('T')[0], dueDate, status: 'REQUESTED', purpose, conditionOut: doc.condition
      };
      setCheckouts(prev => [newChk, ...prev]);
      setDocuments(prev => prev.map(d => d.id === documentId ? { ...d, status: 'REQUESTED' } : d));
      addNotification('info', `Borrow request submitted for Document #${doc.documentNumber}`);
      return newChk;
    }
  };

  const approveCheckout = async (checkoutId: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;

    setCheckouts(prev => prev.map(c => c.id === checkoutId ? { ...c, status: 'APPROVED', approvedByUserId: currentUser.id, approvedByUserName: currentUser.fullName } : c));
    setDocuments(prev => prev.map(d => d.id === chk.documentId ? { ...d, status: 'APPROVED' } : d));

    try {
      await fetch(`/api/checkouts/${checkoutId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser })
      });
    } catch (e) {}

    addNotification('success', `Borrow request for #${chk.documentNumber} approved.`);
  };

  const rejectCheckout = async (checkoutId: string, reason: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;

    setCheckouts(prev => prev.map(c => c.id === checkoutId ? { ...c, status: 'REJECTED', notes: reason } : c));
    setDocuments(prev => prev.map(d => d.id === chk.documentId ? { ...d, status: 'AVAILABLE' } : d));

    try {
      await fetch(`/api/checkouts/${checkoutId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, user: currentUser })
      });
    } catch (e) {}

    addNotification('warning', `Request for #${chk.documentNumber} rejected.`);
  };

  const processCheckoutDispatch = async (checkoutId: string, tempLocationId?: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;
    const doc = documents.find(d => d.id === chk.documentId);
    if (!doc) return;

    const targetTempLocId = tempLocationId || 'loc-dept-eng-office';
    const fromPath = calculatePath(doc.currentLocationId);
    const toPath = calculatePath(targetTempLocId);

    setCheckouts(prev => prev.map(c => c.id === checkoutId ? { ...c, status: 'CHECKED_OUT', checkoutDate: new Date().toISOString().split('T')[0], checkedOutByUserId: currentUser.id, checkedOutByUserName: currentUser.fullName } : c));
    setDocuments(prev => prev.map(d => d.id === chk.documentId ? { ...d, currentLocationId: targetTempLocId, status: 'CHECKED_OUT', custodianName: `${chk.requestedByDepartment} (${chk.requestedByUserName})` } : d));

    try {
      await fetch(`/api/checkouts/${checkoutId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempLocationId: targetTempLocId, user: currentUser, fromPath, toPath })
      });
      await fetchAllFromBackend();
    } catch (e) {}

    addNotification('success', `Document #${doc.documentNumber} checked out successfully.`);
  };

  const processCheckInReturn = async (checkoutId: string, conditionIn: DocumentItem['condition'], returnLocationId: string, notes?: string): Promise<void> => {
    const chk = checkouts.find(c => c.id === checkoutId);
    if (!chk) return;
    const doc = documents.find(d => d.id === chk.documentId);
    if (!doc) return;

    const fromPath = calculatePath(doc.currentLocationId);
    const toPath = calculatePath(returnLocationId);

    setCheckouts(prev => prev.map(c => c.id === checkoutId ? { ...c, status: 'RETURNED', returnDate: new Date().toISOString().split('T')[0], returnedByUserName: currentUser.fullName, conditionIn, notes: notes || c.notes } : c));
    setDocuments(prev => prev.map(d => d.id === chk.documentId ? { ...d, currentLocationId: returnLocationId, status: 'AVAILABLE', condition: conditionIn, custodianName: 'Records Office' } : d));

    try {
      await fetch(`/api/checkouts/${checkoutId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionIn, returnLocationId, notes, user: currentUser, fromPath, toPath })
      });
      await fetchAllFromBackend();
    } catch (e) {}

    addNotification('success', `Document #${doc.documentNumber} returned to archive location.`);
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
        logoutUser,
        approveUser,
        rejectUser,
        deleteUser,
        updateUserProfile,
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
        updateDocument,
        deleteDocument,
        moveDocument,
        batchMoveDocuments,
        requestCheckout,
        approveCheckout,
        rejectCheckout,
        processCheckoutDispatch,
        processCheckInReturn,
        lookupByQR,
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
