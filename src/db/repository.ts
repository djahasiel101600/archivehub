import { getPool, pgPool } from './index.js';
import { 
  User, 
  Department, 
  DocumentTypeInfo, 
  LocationItem, 
  DocumentItem, 
  CheckoutRecord, 
  MovementRecord, 
  AuditLogRecord,
  RetentionPolicy,
  DisposalRecord,
  ReusableCustomField,
  DocumentBundle
} from '../types.js';
import { hashPassword } from '../auth/session.js';
import { buildDocumentNumberPrefix, nextDocumentNumber } from '../utils/documentNumber.js';

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : [];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

function mapUserRow(r: any): User {
  return {
    id: r.id,
    email: r.email,
    password: r.password,
    fullName: r.full_name,
    role: r.role,
    departmentId: r.department_id,
    departmentName: r.department_name,
    avatarUrl: r.avatar_url,
    title: r.title,
    approvalStatus: r.approval_status || 'APPROVED',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined
  };
}

function mapBundleRow(r: any): DocumentBundle {
  return {
    id: r.id,
    bundleNumber: r.bundle_number,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    departmentId: r.department_id,
    departmentName: r.department_name,
    locationId: r.location_id,
    locationPath: r.location_path,
    documentIds: toStringArray(r.document_ids),
    status: r.status,
    qrCode: r.qr_code,
    barcode: r.barcode,
    tags: toStringArray(r.tags),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  };
}

export function applyMemorySeed(data: {
  users: User[];
  departments: Department[];
  documentTypes: DocumentTypeInfo[];
  locations: LocationItem[];
  documents: DocumentItem[];
  checkouts: CheckoutRecord[];
  movements: MovementRecord[];
  retentionPolicies: RetentionPolicy[];
  auditLogs: AuditLogRecord[];
  reusableCustomFields: ReusableCustomField[];
  bundles: DocumentBundle[];
}): void {
  memoryUsers = data.users;
  memoryDepartments = data.departments;
  memoryDocumentTypes = data.documentTypes;
  memoryLocations = data.locations;
  memoryDocuments = data.documents;
  memoryCheckouts = data.checkouts;
  memoryMovements = data.movements;
  memoryRetentionPolicies = data.retentionPolicies;
  memoryAuditLogs = data.auditLogs;
  memoryReusableCustomFields = data.reusableCustomFields;
  memoryBundles = data.bundles;
}

// Fallback in-memory state when PostgreSQL is not connected
let memoryUsers: User[] = [];
let memoryDepartments: Department[] = [];
let memoryDocumentTypes: DocumentTypeInfo[] = [];
let memoryLocations: LocationItem[] = [];
let memoryDocuments: DocumentItem[] = [];
let memoryCheckouts: CheckoutRecord[] = [];
let memoryMovements: MovementRecord[] = [];
let memoryRetentionPolicies: RetentionPolicy[] = [];
let memoryAuditLogs: AuditLogRecord[] = [];
let memoryReusableCustomFields: ReusableCustomField[] = [];
let memoryBundles: DocumentBundle[] = [];

function isDbAvailable(): boolean {
  return Boolean(getPool());
}

// --- USERS REPOSITORY ---
export async function getUsers(): Promise<User[]> {
  if (!isDbAvailable()) return memoryUsers;
  try {
    const res = await pgPool!.query('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map(mapUserRow);
  } catch (err) {
    console.warn('[Repository] getUsers DB query failed, falling back to memory mode:', err);
    return memoryUsers;
  }
}

export async function getUserById(id: string): Promise<User | null> {
  if (!isDbAvailable()) {
    return memoryUsers.find(u => u.id === id) || null;
  }
  try {
    const res = await pgPool!.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  } catch (err) {
    console.warn('[Repository] getUserById DB query failed, falling back to memory mode:', err);
    return memoryUsers.find(u => u.id === id) || null;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isDbAvailable()) {
    return memoryUsers.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }
  try {
    const res = await pgPool!.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  } catch (err) {
    console.warn('[Repository] getUserByEmail DB query failed, falling back to memory mode:', err);
    return memoryUsers.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }
}

export async function createUser(userData: Omit<User, 'id'> & { id?: string }): Promise<User> {
  const id = userData.id || 'usr-reg-' + Date.now();
  const rawPassword = userData.password || 'password123';
  const hashed = rawPassword.startsWith('$2') ? rawPassword : hashPassword(rawPassword);
  const newUser: User = { 
    ...userData, 
    id, 
    password: hashed,
    approvalStatus: userData.approvalStatus || 'PENDING_APPROVAL',
    createdAt: new Date().toISOString() 
  };

  if (!isDbAvailable()) {
    memoryUsers.push(newUser);
    return newUser;
  }

  try {
    await pgPool!.query(`
      INSERT INTO users (id, email, password, full_name, role, department_id, department_name, avatar_url, title, approval_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      newUser.id,
      newUser.email.toLowerCase(),
      newUser.password,
      newUser.fullName,
      newUser.role,
      newUser.departmentId,
      newUser.departmentName,
      newUser.avatarUrl || null,
      newUser.title || null,
      newUser.approvalStatus
    ]);
  } catch (err) {
    console.warn('[Repository] createUser DB query failed, adding to memory:', err);
    memoryUsers.push(newUser);
  }

  return newUser;
}

export async function updateUserApproval(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING_APPROVAL'): Promise<User | null> {
  const userInMemory = memoryUsers.find(u => u.id === id);
  if (userInMemory) {
    userInMemory.approvalStatus = status;
  }

  if (!isDbAvailable()) {
    return userInMemory || null;
  }

  try {
    const res = await pgPool!.query(
      'UPDATE users SET approval_status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (res.rows.length === 0) return userInMemory || null;
    return mapUserRow(res.rows[0]);
  } catch (err) {
    console.warn('[Repository] updateUserApproval DB query failed, using memory:', err);
    return userInMemory || null;
  }
}

export async function updateUserPassword(id: string, hashedPassword: string): Promise<void> {
  const userInMemory = memoryUsers.find(u => u.id === id);
  if (userInMemory) userInMemory.password = hashedPassword;
  if (!isDbAvailable()) return;
  try {
    await pgPool!.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
  } catch (err) {
    console.warn('[Repository] updateUserPassword failed:', err);
  }
}

export type UserProfileUpdates = Partial<Pick<User, 'fullName' | 'email' | 'title' | 'avatarUrl' | 'departmentId' | 'departmentName'>>;

export async function updateUser(id: string, updates: UserProfileUpdates): Promise<User | null> {
  // Reject email changes that would collide with another account
  if (updates.email !== undefined && isDbAvailable()) {
    const dup = await pgPool!.query(
      'SELECT COUNT(*)::int AS c FROM users WHERE LOWER(email) = $1 AND id <> $2',
      [updates.email.trim().toLowerCase(), id]
    );
    if (dup.rows[0].c > 0) {
      throw new Error('Another account with this email address already exists.');
    }
  }

  const userInMemory = memoryUsers.find(u => u.id === id);
  if (userInMemory) {
    Object.assign(userInMemory, updates, updates.email !== undefined ? { email: updates.email.trim().toLowerCase() } : {});
  }

  if (!isDbAvailable()) {
    return userInMemory || null;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.fullName !== undefined) { fields.push(`full_name = $${idx++}`); values.push(updates.fullName); }
    if (updates.email !== undefined) { fields.push(`email = $${idx++}`); values.push(updates.email.trim().toLowerCase()); }
    if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title || null); }
    if (updates.avatarUrl !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(updates.avatarUrl || null); }
    if (updates.departmentId !== undefined) { fields.push(`department_id = $${idx++}`); values.push(updates.departmentId); }
    if (updates.departmentName !== undefined) { fields.push(`department_name = $${idx++}`); values.push(updates.departmentName); }

    if (fields.length === 0) {
      return userInMemory || await getUserById(id);
    }

    values.push(id);
    const res = await pgPool!.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (res.rows.length === 0) return userInMemory || null;
    return mapUserRow(res.rows[0]);
  } catch (err) {
    console.warn('[Repository] updateUser DB query failed, using memory:', err);
    return userInMemory || null;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!isDbAvailable()) {
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    return true;
  }
  try {
    await pgPool!.query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.warn('[Repository] deleteUser DB query failed, removing from memory:', err);
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    return false;
  }
}

// --- DEPARTMENTS REPOSITORY ---
export async function getDepartments(): Promise<Department[]> {
  if (!isDbAvailable()) return memoryDepartments;
  try {
    const res = await pgPool!.query('SELECT * FROM departments ORDER BY name ASC');
    return res.rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      headName: r.head_name,
      documentCount: r.document_count
    }));
  } catch (err) {
    console.warn('[Repository] getDepartments DB query failed, using memory state:', err);
    return memoryDepartments;
  }
}

export async function createDepartment(deptData: Omit<Department, 'id' | 'documentCount'>): Promise<Department> {
  const id = 'dept-' + Date.now();
  const newDept: Department = { ...deptData, id, documentCount: 0 };

  if (!isDbAvailable()) {
    memoryDepartments.push(newDept);
    return newDept;
  }

  // Reject duplicate codes before attempting the insert
  const dupCheck = await pgPool!.query('SELECT COUNT(*)::int AS c FROM departments WHERE code = $1', [newDept.code]);
  if (dupCheck.rows[0].c > 0) {
    throw new Error(`A department with code "${newDept.code}" already exists.`);
  }

  try {
    await pgPool!.query(
      'INSERT INTO departments (id, code, name, head_name, document_count) VALUES ($1, $2, $3, $4, 0)',
      [newDept.id, newDept.code, newDept.name, newDept.headName]
    );
  } catch (err) {
    console.warn('[Repository] createDepartment DB query failed, using memory state:', err);
    memoryDepartments.push(newDept);
  }

  return newDept;
}

export async function updateDepartment(id: string, updates: Partial<Department>): Promise<void> {
  if (!isDbAvailable()) {
    memoryDepartments = memoryDepartments.map(d => d.id === id ? { ...d, ...updates } : d);
    return;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.code !== undefined) { fields.push(`code = $${idx++}`); values.push(updates.code); }
    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.headName !== undefined) { fields.push(`head_name = $${idx++}`); values.push(updates.headName); }

    if (fields.length > 0) {
      values.push(id);
      await pgPool!.query(`UPDATE departments SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    // Keep denormalized department names consistent across records
    if (updates.name !== undefined) {
      await pgPool!.query('UPDATE documents SET department_name = $1 WHERE department_id = $2', [updates.name, id]);
      await pgPool!.query('UPDATE bundles SET department_name = $1 WHERE department_id = $2', [updates.name, id]);
      await pgPool!.query('UPDATE document_types SET department_name = $1 WHERE department_id = $2', [updates.name, id]);
      await pgPool!.query('UPDATE users SET department_name = $1 WHERE department_id = $2', [updates.name, id]);
    }
  } catch (err) {
    console.warn('[Repository] updateDepartment DB query failed, updating memory:', err);
    memoryDepartments = memoryDepartments.map(d => d.id === id ? { ...d, ...updates } : d);
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  if (!isDbAvailable()) {
    memoryDepartments = memoryDepartments.filter(d => d.id !== id);
    return;
  }

  // Guard: block deletion while records, bundles or users still reference the department
  const docRef = await pgPool!.query('SELECT COUNT(*)::int AS c FROM documents WHERE department_id = $1', [id]);
  const bundleRef = await pgPool!.query('SELECT COUNT(*)::int AS c FROM bundles WHERE department_id = $1', [id]);
  const userRef = await pgPool!.query('SELECT COUNT(*)::int AS c FROM users WHERE department_id = $1', [id]);
  if (docRef.rows[0].c > 0 || bundleRef.rows[0].c > 0 || userRef.rows[0].c > 0) {
    throw new Error(`Cannot delete this department yet: ${docRef.rows[0].c} documents, ${bundleRef.rows[0].c} bundles and ${userRef.rows[0].c} users are still assigned to it. Reassign them first.`);
  }

  try {
    await pgPool!.query('DELETE FROM departments WHERE id = $1', [id]);
  } catch (err) {
    console.warn('[Repository] deleteDepartment DB query failed, updating memory:', err);
    memoryDepartments = memoryDepartments.filter(d => d.id !== id);
  }
}

// --- DOCUMENT TYPES REPOSITORY ---
export async function getDocumentTypes(): Promise<DocumentTypeInfo[]> {
  if (!isDbAvailable()) return memoryDocumentTypes;
  try {
    const res = await pgPool!.query('SELECT * FROM document_types ORDER BY name ASC');
    return res.rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      retentionYears: r.retention_years,
      description: r.description,
      departmentId: r.department_id,
      departmentName: r.department_name,
      customFields: r.custom_fields || []
    }));
  } catch (err) {
    console.warn('[Repository] getDocumentTypes DB query failed, using memory state:', err);
    return memoryDocumentTypes;
  }
}

export async function createDocumentType(dtData: Omit<DocumentTypeInfo, 'id'>): Promise<DocumentTypeInfo> {
  const id = 'dt-' + Date.now();
  const newType: DocumentTypeInfo = { ...dtData, id };

  if (!isDbAvailable()) {
    memoryDocumentTypes.push(newType);
    return newType;
  }

  try {
    await pgPool!.query(`
      INSERT INTO document_types (id, code, name, retention_years, description, department_id, department_name, custom_fields)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [newType.id, newType.code, newType.name, newType.retentionYears, newType.description, newType.departmentId || null, newType.departmentName || null, JSON.stringify(newType.customFields || [])]);
  } catch (err) {
    console.warn('[Repository] createDocumentType DB query failed, using memory state:', err);
    memoryDocumentTypes.push(newType);
  }

  return newType;
}

export async function updateDocumentType(id: string, updates: Partial<DocumentTypeInfo>): Promise<void> {
  if (!isDbAvailable()) {
    memoryDocumentTypes = memoryDocumentTypes.map(d => d.id === id ? { ...d, ...updates } : d);
    return;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.code !== undefined) { fields.push(`code = $${idx++}`); values.push(updates.code); }
    if (updates.retentionYears !== undefined) { fields.push(`retention_years = $${idx++}`); values.push(updates.retentionYears); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.departmentId !== undefined) { fields.push(`department_id = $${idx++}`); values.push(updates.departmentId); }
    if (updates.departmentName !== undefined) { fields.push(`department_name = $${idx++}`); values.push(updates.departmentName); }
    if (updates.customFields !== undefined) { fields.push(`custom_fields = $${idx++}`); values.push(JSON.stringify(updates.customFields)); }

    if (fields.length > 0) {
      values.push(id);
      await pgPool!.query(`UPDATE document_types SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
  } catch (err) {
    console.warn('[Repository] updateDocumentType DB query failed, updating memory:', err);
    memoryDocumentTypes = memoryDocumentTypes.map(d => d.id === id ? { ...d, ...updates } : d);
  }
}

export async function deleteDocumentType(id: string): Promise<void> {
  if (!isDbAvailable()) {
    memoryDocumentTypes = memoryDocumentTypes.filter(d => d.id !== id);
    return;
  }
  try {
    await pgPool!.query('DELETE FROM document_types WHERE id = $1', [id]);
  } catch (err) {
    console.warn('[Repository] deleteDocumentType DB query failed, deleting from memory:', err);
    memoryDocumentTypes = memoryDocumentTypes.filter(d => d.id !== id);
  }
}

// --- LOCATIONS REPOSITORY ---
export async function getLocations(): Promise<LocationItem[]> {
  if (!isDbAvailable()) return memoryLocations;
  try {
    const res = await pgPool!.query('SELECT * FROM locations ORDER BY created_at ASC');
    return res.rows.map(r => ({
      id: r.id,
      parentId: r.parent_id,
      type: r.type,
      code: r.code,
      name: r.name,
      description: r.description,
      imageUrl: r.image_url,
      capacity: r.capacity,
      currentOccupancy: r.current_occupancy,
      qrCode: r.qr_code,
      barcode: r.barcode,
      departmentId: r.department_id,
      departmentName: r.department_name,
      latitude: r.latitude !== null && r.latitude !== undefined ? Number(r.latitude) : null,
      longitude: r.longitude !== null && r.longitude !== undefined ? Number(r.longitude) : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : ''
    }));
  } catch (err) {
    console.warn('[Repository] getLocations DB query failed, using memory state:', err);
    return memoryLocations;
  }
}

export async function createLocation(locData: Omit<LocationItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'currentOccupancy'>): Promise<LocationItem> {
  const id = 'loc-' + locData.type.toLowerCase() + '-' + Date.now();
  const code = locData.code || locData.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
  const newLoc: LocationItem = {
    ...locData,
    id,
    code,
    capacity: locData.capacity || 20,
    currentOccupancy: 0,
    qrCode: 'LOC-' + code,
    barcode: '' + (Math.floor(1000000 + Math.random() * 9000000)),
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0]
  };

  if (!isDbAvailable()) {
    memoryLocations.push(newLoc);
    return newLoc;
  }

  try {
    await pgPool!.query(`
      INSERT INTO locations (id, parent_id, type, code, name, description, image_url, capacity, current_occupancy, qr_code, barcode, department_id, department_name, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      newLoc.id, newLoc.parentId, newLoc.type, newLoc.code, newLoc.name,
      newLoc.description || null, newLoc.imageUrl || null, newLoc.capacity,
      newLoc.currentOccupancy, newLoc.qrCode, newLoc.barcode,
      newLoc.departmentId || null, newLoc.departmentName || null,
      newLoc.latitude ?? null, newLoc.longitude ?? null
    ]);
  } catch (err) {
    console.warn('[Repository] createLocation DB query failed, using memory state:', err);
    memoryLocations.push(newLoc);
  }

  return newLoc;
}

export async function updateLocation(id: string, updates: Partial<LocationItem>): Promise<void> {
  if (!isDbAvailable()) {
    memoryLocations = memoryLocations.map(l => l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString().split('T')[0] } : l);
    return;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.type !== undefined) { fields.push(`type = $${idx++}`); values.push(updates.type); }
    if (updates.code !== undefined) { fields.push(`code = $${idx++}`); values.push(updates.code); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.imageUrl !== undefined) { fields.push(`image_url = $${idx++}`); values.push(updates.imageUrl); }
    if (updates.capacity !== undefined) { fields.push(`capacity = $${idx++}`); values.push(updates.capacity); }
    if (updates.parentId !== undefined) { fields.push(`parent_id = $${idx++}`); values.push(updates.parentId); }
    if (updates.latitude !== undefined) { fields.push(`latitude = $${idx++}`); values.push(updates.latitude); }
    if (updates.longitude !== undefined) { fields.push(`longitude = $${idx++}`); values.push(updates.longitude); }

    fields.push(`updated_at = NOW()`);

    if (fields.length > 0) {
      values.push(id);
      await pgPool!.query(`UPDATE locations SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
  } catch (err) {
    console.warn('[Repository] updateLocation DB query failed, updating memory:', err);
    memoryLocations = memoryLocations.map(l => l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString().split('T')[0] } : l);
  }
}

export async function deleteLocation(id: string): Promise<boolean> {
  if (!isDbAvailable()) {
    const hasChildren = memoryLocations.some(l => l.parentId === id);
    const hasDocs = memoryDocuments.some(d => d.homeLocationId === id || d.currentLocationId === id);
    if (hasChildren || hasDocs) return false;
    memoryLocations = memoryLocations.filter(l => l.id !== id);
    return true;
  }

  try {
    const childCheck = await pgPool!.query('SELECT COUNT(*) FROM locations WHERE parent_id = $1', [id]);
    const docCheck = await pgPool!.query('SELECT COUNT(*) FROM documents WHERE home_location_id = $1 OR current_location_id = $1', [id]);
    
    if (parseInt(childCheck.rows[0].count, 10) > 0 || parseInt(docCheck.rows[0].count, 10) > 0) {
      return false;
    }

    await pgPool!.query('DELETE FROM locations WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.warn('[Repository] deleteLocation DB query failed, fallback to memory:', err);
    const hasChildren = memoryLocations.some(l => l.parentId === id);
    const hasDocs = memoryDocuments.some(d => d.homeLocationId === id || d.currentLocationId === id);
    if (hasChildren || hasDocs) return false;
    memoryLocations = memoryLocations.filter(l => l.id !== id);
    return true;
  }
}

// --- DOCUMENTS REPOSITORY ---
export async function getDocumentById(id: string): Promise<DocumentItem | null> {
  const docs = await getDocuments();
  return docs.find(d => d.id === id) || null;
}

export async function getDocuments(): Promise<DocumentItem[]> {
  if (!isDbAvailable()) return memoryDocuments;
  try {
    const res = await pgPool!.query('SELECT * FROM documents ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      documentNumber: r.document_number,
      referenceNumber: r.reference_number,
      title: r.title,
      documentTypeId: r.document_type_id,
      documentTypeName: r.document_type_name,
      subject: r.subject,
      description: r.description,
      departmentId: r.department_id,
      departmentName: r.department_name,
      custodianName: r.custodian_name,
      homeLocationId: r.home_location_id,
      currentLocationId: r.current_location_id,
      status: r.status,
      confidentiality: r.confidentiality,
      condition: r.condition,
      qrCode: r.qr_code,
      barcode: r.barcode,
      documentDate: r.document_date,
      receivedDate: r.received_date,
      filedDate: r.filed_date,
      retentionStartDate: r.retention_start_date,
      retentionEndDate: r.retention_end_date,
      disposalDate: r.disposal_date,
      hasDigitalCopy: r.has_digital_copy,
      digitalFileName: r.digital_file_name,
      digitalFileSize: r.digital_file_size,
      digitalFileType: r.digital_file_type,
      digitalFileVersion: r.digital_file_version,
      digitalFilePath: r.digital_file_path || undefined,
      customMetadata: r.custom_metadata || [],
      customFieldValues: r.custom_field_values || {},
      conditionNotes: r.condition_notes,
      bundleId: r.bundle_id,
      bundleNumber: r.bundle_number,
      bundleTitle: r.bundle_title,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.warn('[Repository] getDocuments DB query failed, using memory state:', err);
    return memoryDocuments;
  }
}

/**
 * Generate the next structured document number for a department + document
 * type pair: `{DEPT_CODE}-{TYPE_CODE}-{NNNN}` (e.g. ENG-ARCH-0001). The
 * sequential suffix is scoped per prefix and derived from the highest number
 * already registered under that prefix.
 */
export async function generateDocumentNumber(departmentId: string, documentTypeId: string): Promise<string> {
  const departments = await getDepartments();
  const documentTypes = await getDocumentTypes();
  const dept = departments.find(d => d.id === departmentId);
  const type = documentTypes.find(dt => dt.id === documentTypeId);
  const prefix = buildDocumentNumberPrefix(dept?.code, type?.code);

  if (!isDbAvailable()) {
    return nextDocumentNumber(prefix, memoryDocuments.map(d => d.documentNumber));
  }

  // Prefix is sanitized to [A-Z0-9-], so it is safe inside a LIKE pattern
  const res = await pgPool!.query(
    'SELECT document_number FROM documents WHERE document_number LIKE $1',
    [`${prefix}-%`]
  );
  return nextDocumentNumber(prefix, res.rows.map(r => r.document_number as string));
}

export async function createDocument(docData: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'status' | 'currentLocationId'>, user: User, homePath: string): Promise<DocumentItem> {
  const id = 'doc-' + Date.now();
  // Blank document number = auto-generate from department code + type code
  const autoGenerate = !docData.documentNumber?.trim();
  const documentNumber = docData.documentNumber?.trim() || await generateDocumentNumber(docData.departmentId, docData.documentTypeId);
  const qrCode = 'DOC-' + documentNumber;
  const barcode = '884' + Math.floor(100000 + Math.random() * 900000);

  const newDoc: DocumentItem = {
    ...docData,
    documentNumber,
    id,
    currentLocationId: docData.homeLocationId,
    status: 'AVAILABLE',
    qrCode,
    barcode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!isDbAvailable()) {
    memoryDocuments.unshift(newDoc);
    // Movement
    memoryMovements.unshift({
      id: 'mvt-' + Date.now(),
      documentId: id,
      documentNumber: newDoc.documentNumber,
      documentTitle: newDoc.title,
      fromLocationId: docData.homeLocationId,
      fromLocationPath: 'Registration Desk Staging',
      toLocationId: docData.homeLocationId,
      toLocationPath: homePath,
      movementType: 'INITIAL_FILING',
      performedByUserId: user.id,
      performedByUserName: user.fullName,
      reason: 'Initial Registration & Physical Filing',
      timestamp: new Date().toISOString()
    });
    // Audit Log
    memoryAuditLogs.unshift({
      id: 'aud-' + Date.now(),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'DOCUMENT_REGISTERED',
      entityType: 'DOCUMENT',
      entityId: id,
      entityName: newDoc.title,
      timestamp: new Date().toISOString(),
      details: `Registered record #${newDoc.documentNumber} into home archive location: ${homePath}`
    });
    return newDoc;
  }

  // PostgreSQL Transaction — auto-generated numbers retry on unique conflicts
  const maxAttempts = autoGenerate ? 5 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pgPool!.connect();
      try {
        await client.query('BEGIN');

        await client.query(`
        INSERT INTO documents (
          id, document_number, reference_number, title, document_type_id, document_type_name,
          subject, description, department_id, department_name, custodian_name,
          home_location_id, current_location_id, status, confidentiality, condition,
          qr_code, barcode, document_date, received_date, filed_date, retention_start_date,
          retention_end_date, disposal_date, has_digital_copy, digital_file_name, digital_file_size,
          digital_file_type, digital_file_version, custom_metadata, custom_field_values, condition_notes,
          bundle_id, bundle_number, bundle_title
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
        )
      `, [
        newDoc.id, newDoc.documentNumber, newDoc.referenceNumber, newDoc.title, newDoc.documentTypeId, newDoc.documentTypeName,
        newDoc.subject || null, newDoc.description || null, newDoc.departmentId, newDoc.departmentName, newDoc.custodianName,
        newDoc.homeLocationId, newDoc.currentLocationId, newDoc.status, newDoc.confidentiality, newDoc.condition,
        newDoc.qrCode, newDoc.barcode, newDoc.documentDate, newDoc.receivedDate || null, newDoc.filedDate || null, newDoc.retentionStartDate || null,
        newDoc.retentionEndDate || null, newDoc.disposalDate || null, newDoc.hasDigitalCopy, newDoc.digitalFileName || null, newDoc.digitalFileSize || null,
        newDoc.digitalFileType || null, newDoc.digitalFileVersion || 1, JSON.stringify(newDoc.customMetadata || []), JSON.stringify(newDoc.customFieldValues || {}), newDoc.conditionNotes || null,
        newDoc.bundleId || null, newDoc.bundleNumber || null, newDoc.bundleTitle || null
      ]);

        // Initial Filing Movement
        await client.query(`
        INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        'mvt-' + Date.now(), id, newDoc.documentNumber, newDoc.title, docData.homeLocationId,
        'Registration Desk Staging', docData.homeLocationId, homePath, 'INITIAL_FILING',
        user.id, user.fullName, 'Initial Registration & Physical Filing'
      ]);

        // Audit Log
        await client.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'aud-' + Date.now(), user.id, user.fullName, user.role, 'DOCUMENT_REGISTERED',
        'DOCUMENT', id, newDoc.title, `Registered record #${newDoc.documentNumber} into home archive location: ${homePath}`
      ]);

        await client.query('COMMIT');
        return newDoc;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      const isUniqueViolation = err?.code === '23505';
      if (isUniqueViolation && autoGenerate && attempt < maxAttempts) {
        // A concurrent registration claimed this number — regenerate and retry
        const retryNumber = await generateDocumentNumber(docData.departmentId, docData.documentTypeId);
        newDoc.documentNumber = retryNumber;
        newDoc.qrCode = 'DOC-' + retryNumber;
        continue;
      }
      console.warn('[Repository] createDocument DB transaction failed, adding to memory:', err);
      memoryDocuments.unshift(newDoc);
      return newDoc;
    }
  }

  // Unreachable — the loop above always returns
  return newDoc;
}

export async function updateDocument(id: string, updates: Partial<DocumentItem>, user: User): Promise<void> {
  const existingDoc = memoryDocuments.find(d => d.id === id);
  const docTitle = updates.title || existingDoc?.title || 'Document Record';
  const docNumber = updates.documentNumber || existingDoc?.documentNumber || id;

  if (!isDbAvailable()) {
    memoryDocuments = memoryDocuments.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d);
    
    // Add Audit Log
    memoryAuditLogs.unshift({
      id: 'aud-' + Date.now(),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'DOCUMENT_UPDATED',
      entityType: 'DOCUMENT',
      entityId: id,
      entityName: docTitle,
      timestamp: new Date().toISOString(),
      details: `Updated metadata and attributes for document #${docNumber}`
    });
    return;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
    if (updates.referenceNumber !== undefined) { fields.push(`reference_number = $${idx++}`); values.push(updates.referenceNumber); }
    if (updates.documentTypeId !== undefined) { fields.push(`document_type_id = $${idx++}`); values.push(updates.documentTypeId); }
    if (updates.documentTypeName !== undefined) { fields.push(`document_type_name = $${idx++}`); values.push(updates.documentTypeName); }
    if (updates.subject !== undefined) { fields.push(`subject = $${idx++}`); values.push(updates.subject); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.departmentId !== undefined) { fields.push(`department_id = $${idx++}`); values.push(updates.departmentId); }
    if (updates.departmentName !== undefined) { fields.push(`department_name = $${idx++}`); values.push(updates.departmentName); }
    if (updates.custodianName !== undefined) { fields.push(`custodian_name = $${idx++}`); values.push(updates.custodianName); }
    if (updates.homeLocationId !== undefined) { fields.push(`home_location_id = $${idx++}`); values.push(updates.homeLocationId); }
    if (updates.currentLocationId !== undefined) { fields.push(`current_location_id = $${idx++}`); values.push(updates.currentLocationId); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.confidentiality !== undefined) { fields.push(`confidentiality = $${idx++}`); values.push(updates.confidentiality); }
    if (updates.condition !== undefined) { fields.push(`condition = $${idx++}`); values.push(updates.condition); }
    if (updates.conditionNotes !== undefined) { fields.push(`condition_notes = $${idx++}`); values.push(updates.conditionNotes); }
    if (updates.documentDate !== undefined) { fields.push(`document_date = $${idx++}`); values.push(updates.documentDate); }
    if (updates.receivedDate !== undefined) { fields.push(`received_date = $${idx++}`); values.push(updates.receivedDate); }
    if (updates.filedDate !== undefined) { fields.push(`filed_date = $${idx++}`); values.push(updates.filedDate); }
    if (updates.retentionStartDate !== undefined) { fields.push(`retention_start_date = $${idx++}`); values.push(updates.retentionStartDate); }
    if (updates.retentionEndDate !== undefined) { fields.push(`retention_end_date = $${idx++}`); values.push(updates.retentionEndDate); }
    if (updates.disposalDate !== undefined) { fields.push(`disposal_date = $${idx++}`); values.push(updates.disposalDate); }
    if (updates.hasDigitalCopy !== undefined) { fields.push(`has_digital_copy = $${idx++}`); values.push(updates.hasDigitalCopy); }
    if (updates.digitalFileName !== undefined) { fields.push(`digital_file_name = $${idx++}`); values.push(updates.digitalFileName); }
    if (updates.digitalFileSize !== undefined) { fields.push(`digital_file_size = $${idx++}`); values.push(updates.digitalFileSize); }
    if (updates.digitalFileType !== undefined) { fields.push(`digital_file_type = $${idx++}`); values.push(updates.digitalFileType); }
    if (updates.digitalFileVersion !== undefined) { fields.push(`digital_file_version = $${idx++}`); values.push(updates.digitalFileVersion); }
    if (updates.digitalFilePath !== undefined) { fields.push(`digital_file_path = $${idx++}`); values.push(updates.digitalFilePath); }
    if (updates.customMetadata !== undefined) { fields.push(`custom_metadata = $${idx++}`); values.push(JSON.stringify(updates.customMetadata)); }
    if (updates.customFieldValues !== undefined) { fields.push(`custom_field_values = $${idx++}`); values.push(JSON.stringify(updates.customFieldValues)); }
    if (updates.bundleId !== undefined) { fields.push(`bundle_id = $${idx++}`); values.push(updates.bundleId); }
    if (updates.bundleNumber !== undefined) { fields.push(`bundle_number = $${idx++}`); values.push(updates.bundleNumber); }
    if (updates.bundleTitle !== undefined) { fields.push(`bundle_title = $${idx++}`); values.push(updates.bundleTitle); }

    fields.push(`updated_at = NOW()`);

    if (fields.length > 0) {
      values.push(id);
      await pgPool!.query(`UPDATE documents SET ${fields.join(', ')} WHERE id = $${idx}`, values);

      // Audit Log in PostgreSQL
      await pgPool!.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'aud-' + Date.now(), user.id, user.fullName, user.role, 'DOCUMENT_UPDATED',
        'DOCUMENT', id, docTitle, `Updated metadata and attributes for document #${docNumber}`
      ]);
    }
  } catch (err) {
    console.warn('[Repository] updateDocument DB query failed, updating memory:', err);
    memoryDocuments = memoryDocuments.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d);
  }
}

export async function deleteDocument(id: string, user: User): Promise<boolean> {
  if (!isDbAvailable()) {
    const doc = memoryDocuments.find(d => d.id === id);
    if (!doc || doc.status === 'CHECKED_OUT') return false;
    memoryDocuments = memoryDocuments.filter(d => d.id !== id);
    return true;
  }

  try {
    const res = await pgPool!.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (res.rows.length === 0) return false;
    const doc = res.rows[0];
    if (doc.status === 'CHECKED_OUT') return false;

    await pgPool!.query('DELETE FROM documents WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.warn('[Repository] deleteDocument DB query failed, fallback memory:', err);
    const doc = memoryDocuments.find(d => d.id === id);
    if (!doc || doc.status === 'CHECKED_OUT') return false;
    memoryDocuments = memoryDocuments.filter(d => d.id !== id);
    return true;
  }
}

export async function moveDocument(documentId: string, toLocationId: string, reason: string, user: User, fromPath: string, toPath: string): Promise<void> {
  if (!isDbAvailable()) {
    memoryDocuments = memoryDocuments.map(d => d.id === documentId ? { ...d, currentLocationId: toLocationId, updatedAt: new Date().toISOString() } : d);
    const doc = memoryDocuments.find(d => d.id === documentId);
    if (doc) {
      memoryMovements.unshift({
        id: 'mvt-' + Date.now(),
        documentId,
        documentNumber: doc.documentNumber,
        documentTitle: doc.title,
        fromLocationId: doc.currentLocationId,
        fromLocationPath: fromPath,
        toLocationId,
        toLocationPath: toPath,
        movementType: 'RELOCATION',
        performedByUserId: user.id,
        performedByUserName: user.fullName,
        reason: reason || 'Physical Relocation Transfer',
        timestamp: new Date().toISOString()
      });
    }
    return;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');

      const docRes = await client.query('SELECT * FROM documents WHERE id = $1', [documentId]);
      if (docRes.rows.length === 0) throw new Error('Document not found');
      const doc = docRes.rows[0];

      await client.query('UPDATE documents SET current_location_id = $1, updated_at = NOW() WHERE id = $2', [toLocationId, documentId]);

      await client.query(`
        INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        'mvt-' + Date.now(), documentId, doc.document_number, doc.title, doc.current_location_id,
        fromPath, toLocationId, toPath, 'RELOCATION', user.id, user.fullName, reason || 'Physical Relocation'
      ]);

      await client.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'aud-' + Date.now(), user.id, user.fullName, user.role, 'DOCUMENT_MOVED',
        'DOCUMENT', documentId, doc.title, `Relocated record from [${fromPath}] to [${toPath}]. Reason: ${reason}`
      ]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] moveDocument DB failed, using memory state:', err);
    memoryDocuments = memoryDocuments.map(d => d.id === documentId ? { ...d, currentLocationId: toLocationId, updatedAt: new Date().toISOString() } : d);
  }
}

// --- CHECKOUTS REPOSITORY ---
export async function getCheckouts(): Promise<CheckoutRecord[]> {
  if (!isDbAvailable()) return memoryCheckouts;
  try {
    const res = await pgPool!.query('SELECT * FROM checkouts ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      documentId: r.document_id,
      documentNumber: r.document_number,
      documentTitle: r.document_title,
      requestedByUserId: r.requested_by_user_id,
      requestedByUserName: r.requested_by_user_name,
      requestedByDepartment: r.requested_by_department,
      approvedByUserId: r.approved_by_user_id,
      approvedByUserName: r.approved_by_user_name,
      checkedOutByUserId: r.checked_out_by_user_id,
      checkedOutByUserName: r.checked_out_by_user_name,
      returnedByUserName: r.returned_by_user_name,
      requestDate: r.request_date,
      checkoutDate: r.checkout_date,
      dueDate: r.due_date,
      returnDate: r.return_date,
      status: r.status,
      purpose: r.purpose,
      conditionOut: r.condition_out,
      conditionIn: r.condition_in,
      notes: r.notes
    }));
  } catch (err) {
    console.warn('[Repository] getCheckouts DB query failed, using memory state:', err);
    return memoryCheckouts;
  }
}

export async function requestCheckout(documentId: string, purpose: string, dueDate: string, user: User): Promise<CheckoutRecord> {
  const docList = await getDocuments();
  const doc = docList.find(d => d.id === documentId);
  if (!doc) throw new Error('Document not found');

  const id = 'chk-' + Date.now();
  const newChk: CheckoutRecord = {
    id,
    documentId,
    documentNumber: doc.documentNumber,
    documentTitle: doc.title,
    requestedByUserId: user.id,
    requestedByUserName: user.fullName,
    requestedByDepartment: user.departmentName,
    requestDate: new Date().toISOString().split('T')[0],
    dueDate,
    status: 'REQUESTED',
    purpose,
    conditionOut: doc.condition
  };

  if (!isDbAvailable()) {
    memoryCheckouts.unshift(newChk);
    memoryDocuments = memoryDocuments.map(d => d.id === documentId ? { ...d, status: 'REQUESTED' } : d);
    return newChk;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO checkouts (id, document_id, document_number, document_title, requested_by_user_id, requested_by_user_name, requested_by_department, request_date, due_date, status, purpose, condition_out)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        id, documentId, doc.documentNumber, doc.title, user.id, user.fullName, user.departmentName,
        newChk.requestDate, dueDate, 'REQUESTED', purpose, doc.condition
      ]);

      await client.query('UPDATE documents SET status = $1 WHERE id = $2', ['REQUESTED', documentId]);

      await client.query('COMMIT');
      return newChk;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] requestCheckout DB transaction failed, fallback to memory:', err);
    memoryCheckouts.unshift(newChk);
    memoryDocuments = memoryDocuments.map(d => d.id === documentId ? { ...d, status: 'REQUESTED' } : d);
    return newChk;
  }
}

export async function approveCheckout(checkoutId: string, user: User): Promise<void> {
  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? { ...c, status: 'APPROVED', approvedByUserId: user.id, approvedByUserName: user.fullName } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? { ...d, status: 'APPROVED' } : d);
    return;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1', [checkoutId]);
      if (chkRes.rows.length === 0) throw new Error('Checkout not found');
      const chk = chkRes.rows[0];

      await client.query(`
        UPDATE checkouts SET status = $1, approved_by_user_id = $2, approved_by_user_name = $3 WHERE id = $4
      `, ['APPROVED', user.id, user.fullName, checkoutId]);

      await client.query('UPDATE documents SET status = $1 WHERE id = $2', ['APPROVED', chk.document_id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] approveCheckout DB failed, fallback memory:', err);
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? { ...c, status: 'APPROVED', approvedByUserId: user.id, approvedByUserName: user.fullName } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? { ...d, status: 'APPROVED' } : d);
  }
}

export async function rejectCheckout(checkoutId: string, reason: string, user: User): Promise<void> {
  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? { ...c, status: 'REJECTED', notes: reason } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? { ...d, status: 'AVAILABLE' } : d);
    return;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1', [checkoutId]);
      if (chkRes.rows.length === 0) throw new Error('Checkout not found');
      const chk = chkRes.rows[0];

      await client.query('UPDATE checkouts SET status = $1, notes = $2 WHERE id = $3', ['REJECTED', reason, checkoutId]);
      await client.query('UPDATE documents SET status = $1 WHERE id = $2', ['AVAILABLE', chk.document_id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] rejectCheckout DB failed, fallback memory:', err);
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? { ...c, status: 'REJECTED', notes: reason } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? { ...d, status: 'AVAILABLE' } : d);
  }
}

export async function processCheckoutDispatch(
  checkoutId: string, 
  tempLocationId: string, 
  user: User, 
  fromPath: string, 
  toPath: string
): Promise<void> {
  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? {
      ...c, status: 'CHECKED_OUT', checkoutDate: new Date().toISOString().split('T')[0], checkedOutByUserId: user.id, checkedOutByUserName: user.fullName
    } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? {
      ...d, currentLocationId: tempLocationId, status: 'CHECKED_OUT', custodianName: `${chk.requestedByDepartment} (${chk.requestedByUserName})`
    } : d);
    memoryMovements.unshift({
      id: 'mvt-' + Date.now(),
      documentId: chk.documentId,
      documentNumber: chk.documentNumber,
      documentTitle: chk.documentTitle,
      fromLocationId: chk.documentId,
      fromLocationPath: fromPath,
      toLocationId: tempLocationId,
      toLocationPath: toPath,
      movementType: 'CHECKOUT',
      performedByUserId: user.id,
      performedByUserName: user.fullName,
      reason: `Authorized Physical Checkout for ${chk.requestedByUserName}`,
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1', [checkoutId]);
      if (chkRes.rows.length === 0) throw new Error('Checkout not found');
      const chk = chkRes.rows[0];

      await client.query(`
        UPDATE checkouts 
        SET status = $1, checkout_date = $2, checked_out_by_user_id = $3, checked_out_by_user_name = $4 
        WHERE id = $5
      `, ['CHECKED_OUT', new Date().toISOString().split('T')[0], user.id, user.fullName, checkoutId]);

      await client.query(`
        UPDATE documents 
        SET current_location_id = $1, status = $2, custodian_name = $3, updated_at = NOW() 
        WHERE id = $4
      `, [tempLocationId, 'CHECKED_OUT', `${chk.requested_by_department} (${chk.requested_by_user_name})`, chk.document_id]);

      await client.query(`
        INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        'mvt-' + Date.now(), chk.document_id, chk.document_number, chk.document_title,
        chk.document_id, fromPath, tempLocationId, toPath, 'CHECKOUT',
        user.id, user.fullName, `Authorized Physical Checkout for ${chk.requested_by_user_name}`
      ]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] processCheckoutDispatch DB failed, fallback memory:', err);
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? {
      ...c, status: 'CHECKED_OUT', checkoutDate: new Date().toISOString().split('T')[0], checkedOutByUserId: user.id, checkedOutByUserName: user.fullName
    } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? {
      ...d, currentLocationId: tempLocationId, status: 'CHECKED_OUT', custodianName: `${chk.requestedByDepartment} (${chk.requestedByUserName})`
    } : d);
  }
}

export async function processCheckInReturn(
  checkoutId: string, 
  conditionIn: DocumentItem['condition'], 
  returnLocationId: string, 
  notes: string | undefined, 
  user: User, 
  fromPath: string, 
  toPath: string
): Promise<void> {
  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? {
      ...c, status: 'RETURNED', returnDate: new Date().toISOString().split('T')[0], conditionIn, returnedByUserName: user.fullName, notes: notes || c.notes
    } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? {
      ...d, currentLocationId: returnLocationId, status: 'AVAILABLE', condition: conditionIn, custodianName: 'Records Office'
    } : d);
    return;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1', [checkoutId]);
      if (chkRes.rows.length === 0) throw new Error('Checkout record not found');
      const chk = chkRes.rows[0];

      await client.query(`
        UPDATE checkouts 
        SET status = $1, return_date = $2, condition_in = $3, returned_by_user_name = $4, notes = $5 
        WHERE id = $6
      `, ['RETURNED', new Date().toISOString().split('T')[0], conditionIn, user.fullName, notes || chk.notes || null, checkoutId]);

      await client.query(`
        UPDATE documents 
        SET current_location_id = $1, status = $2, condition = $3, custodian_name = $4, updated_at = NOW() 
        WHERE id = $5
      `, [returnLocationId, 'AVAILABLE', conditionIn, 'Records Office', chk.document_id]);

      await client.query(`
        INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        'mvt-' + Date.now(), chk.document_id, chk.document_number, chk.document_title,
        chk.document_id, fromPath, returnLocationId, toPath, 'CHECKIN',
        user.id, user.fullName, `Check-In Return to Archive Storage. Condition: ${conditionIn}`
      ]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] processCheckInReturn DB failed, fallback memory:', err);
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) return;
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? {
      ...c, status: 'RETURNED', returnDate: new Date().toISOString().split('T')[0], conditionIn, returnedByUserName: user.fullName, notes: notes || c.notes
    } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? {
      ...d, currentLocationId: returnLocationId, status: 'AVAILABLE', condition: conditionIn, custodianName: 'Records Office'
    } : d);
  }
}

// --- MOVEMENTS REPOSITORY ---
export async function getMovements(): Promise<MovementRecord[]> {
  if (!isDbAvailable()) return memoryMovements;
  try {
    const res = await pgPool!.query('SELECT * FROM movements ORDER BY timestamp DESC');
    return res.rows.map(r => ({
      id: r.id,
      documentId: r.document_id,
      documentNumber: r.document_number,
      documentTitle: r.document_title,
      fromLocationId: r.from_location_id,
      fromLocationPath: r.from_location_path,
      toLocationId: r.to_location_id,
      toLocationPath: r.to_location_path,
      movementType: r.movement_type,
      performedByUserId: r.performed_by_user_id,
      performedByUserName: r.performed_by_user_name,
      authorizedByUserName: r.authorized_by_user_name,
      reason: r.reason,
      timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
      notes: r.notes
    }));
  } catch (err) {
    console.warn('[Repository] getMovements DB query failed, using memory state:', err);
    return memoryMovements;
  }
}

// --- RETENTION POLICIES REPOSITORY ---
export async function getRetentionPolicies(): Promise<RetentionPolicy[]> {
  if (!isDbAvailable()) return memoryRetentionPolicies;
  try {
    const res = await pgPool!.query('SELECT * FROM retention_policies ORDER BY document_type_name ASC');
    return res.rows.map(r => ({
      id: r.id,
      documentTypeId: r.document_type_id,
      documentTypeName: r.document_type_name,
      retentionYears: r.retention_years,
      disposalMethod: r.disposal_method,
      description: r.description
    }));
  } catch (err) {
    console.warn('[Repository] getRetentionPolicies DB query failed, using memory state:', err);
    return memoryRetentionPolicies;
  }
}

// --- AUDIT LOGS REPOSITORY ---
export async function getAuditLogs(): Promise<AuditLogRecord[]> {
  if (!isDbAvailable()) return memoryAuditLogs;
  try {
    const res = await pgPool!.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userRole: r.user_role,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityName: r.entity_name,
      timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
      details: r.details,
      beforeValue: r.before_value,
      afterValue: r.after_value
    }));
  } catch (err) {
    console.warn('[Repository] getAuditLogs DB query failed, using memory state:', err);
    return memoryAuditLogs;
  }
}

export async function createAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<AuditLogRecord> {
  const id = 'aud-' + Date.now();
  const timestamp = new Date().toISOString();
  const newLog: AuditLogRecord = { ...log, id, timestamp };

  if (!isDbAvailable()) {
    memoryAuditLogs.unshift(newLog);
    return newLog;
  }

  try {
    await pgPool!.query(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, before_value, after_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [id, log.userId, log.userName, log.userRole, log.action, log.entityType, log.entityId, log.entityName, log.details, log.beforeValue || null, log.afterValue || null]);
  } catch (err) {
    console.warn('[Repository] createAuditLog DB query failed, adding to memory:', err);
    memoryAuditLogs.unshift(newLog);
  }

  return newLog;
}

export async function clearCustomDataFromDb(): Promise<{ success: boolean; message: string }> {
  // Clear memory fallback arrays
  memoryLocations = [];
  memoryDocuments = [];
  memoryCheckouts = [];
  memoryMovements = [];
  memoryAuditLogs = [];
  memoryRetentionPolicies = [];

  if (!isDbAvailable()) {
    return { success: true, message: 'In-memory operational dataset cleared.' };
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE checkouts, movements, disposal_records, retention_policies, audit_logs, documents, locations, bundles CASCADE');
      await client.query('COMMIT');
      return { success: true, message: 'PostgreSQL database tables cascade cleared successfully.' };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.warn('[Repository] TRUNCATE CASCADE failed, attempting transactional DELETE queries:', err?.message);
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM checkouts');
        await client.query('DELETE FROM movements');
        await client.query('DELETE FROM disposal_records');
        await client.query('DELETE FROM retention_policies');
        await client.query('DELETE FROM audit_logs');
        await client.query('DELETE FROM documents');
        await client.query('DELETE FROM locations');
        await client.query('DELETE FROM bundles');
        await client.query('COMMIT');
        return { success: true, message: 'PostgreSQL database tables cleared via cascade delete.' };
      } catch (delErr: any) {
        await client.query('ROLLBACK');
        return { success: false, message: `Failed to clear database tables: ${delErr?.message || 'Unknown error'}` };
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Database connection error' };
  }
}

// --- REUSABLE CUSTOM FIELDS REPOSITORY ---
export async function getReusableCustomFields(): Promise<ReusableCustomField[]> {
  if (!isDbAvailable()) return memoryReusableCustomFields;
  try {
    const res = await pgPool!.query('SELECT * FROM reusable_custom_fields ORDER BY created_at ASC');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      label: r.label,
      type: r.type,
      options: r.options || [],
      placeholder: r.placeholder,
      required: r.required,
      description: r.description,
      category: r.category || 'General',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.warn('[Repository] getReusableCustomFields DB query failed, using memory state:', err);
    return memoryReusableCustomFields;
  }
}

export async function createReusableCustomField(data: Omit<ReusableCustomField, 'id' | 'createdAt'>): Promise<ReusableCustomField> {
  const id = 'rcf-' + Date.now();
  const newField: ReusableCustomField = {
    ...data,
    id,
    createdAt: new Date().toISOString()
  };

  if (!isDbAvailable()) {
    memoryReusableCustomFields.push(newField);
    return newField;
  }

  try {
    await pgPool!.query(`
      INSERT INTO reusable_custom_fields (id, name, label, type, options, placeholder, required, description, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      newField.id, newField.name, newField.label, newField.type,
      JSON.stringify(newField.options || []), newField.placeholder || null,
      newField.required || false, newField.description || null, newField.category || 'General'
    ]);
  } catch (err) {
    console.warn('[Repository] createReusableCustomField DB query failed, using memory state:', err);
    memoryReusableCustomFields.push(newField);
  }

  return newField;
}

export async function updateReusableCustomField(id: string, updates: Partial<ReusableCustomField>): Promise<void> {
  if (!isDbAvailable()) {
    memoryReusableCustomFields = memoryReusableCustomFields.map(f => f.id === id ? { ...f, ...updates } : f);
    return;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.label !== undefined) { fields.push(`label = $${idx++}`); values.push(updates.label); }
    if (updates.type !== undefined) { fields.push(`type = $${idx++}`); values.push(updates.type); }
    if (updates.options !== undefined) { fields.push(`options = $${idx++}`); values.push(JSON.stringify(updates.options)); }
    if (updates.placeholder !== undefined) { fields.push(`placeholder = $${idx++}`); values.push(updates.placeholder); }
    if (updates.required !== undefined) { fields.push(`required = $${idx++}`); values.push(updates.required); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.category !== undefined) { fields.push(`category = $${idx++}`); values.push(updates.category); }

    if (fields.length > 0) {
      values.push(id);
      await pgPool!.query(`UPDATE reusable_custom_fields SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
  } catch (err) {
    console.warn('[Repository] updateReusableCustomField DB query failed, updating memory:', err);
    memoryReusableCustomFields = memoryReusableCustomFields.map(f => f.id === id ? { ...f, ...updates } : f);
  }
}

export async function deleteReusableCustomField(id: string): Promise<void> {
  if (!isDbAvailable()) {
    memoryReusableCustomFields = memoryReusableCustomFields.filter(f => f.id !== id);
    return;
  }
  try {
    await pgPool!.query('DELETE FROM reusable_custom_fields WHERE id = $1', [id]);
  } catch (err) {
    console.warn('[Repository] deleteReusableCustomField DB query failed, deleting from memory:', err);
    memoryReusableCustomFields = memoryReusableCustomFields.filter(f => f.id !== id);
  }
}

// --- BUNDLES REPOSITORY ---
export async function getBundles(): Promise<DocumentBundle[]> {
  if (!isDbAvailable()) return memoryBundles;
  try {
    const res = await pgPool!.query('SELECT * FROM bundles ORDER BY created_at DESC');
    return res.rows.map(mapBundleRow);
  } catch (err) {
    console.warn('[Repository] getBundles DB query failed, using memory state:', err);
    return memoryBundles;
  }
}

export async function createBundle(data: Omit<DocumentBundle, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode'>, user?: User): Promise<DocumentBundle> {
  const id = 'bndl-' + Date.now();
  const qrCode = 'BNDL-' + data.bundleNumber;
  const barcode = '889' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date().toISOString();

  const newBundle: DocumentBundle = {
    ...data,
    id,
    qrCode,
    barcode,
    createdAt: now,
    updatedAt: now
  };

  if (!isDbAvailable()) {
    memoryBundles.unshift(newBundle);
    // Update documents in memory with this bundle
    if (newBundle.documentIds && newBundle.documentIds.length > 0) {
      memoryDocuments = memoryDocuments.map(d => {
        if (newBundle.documentIds.includes(d.id)) {
          return { ...d, bundleId: newBundle.id, bundleNumber: newBundle.bundleNumber, bundleTitle: newBundle.title, updatedAt: now };
        }
        return d;
      });
    }
    return newBundle;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO bundles (id, bundle_number, title, description, image_url, department_id, department_name, location_id, location_path, document_ids, status, qr_code, barcode, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        newBundle.id, newBundle.bundleNumber, newBundle.title, newBundle.description || null,
        newBundle.imageUrl || null,
        newBundle.departmentId, newBundle.departmentName, newBundle.locationId || null,
        newBundle.locationPath || null, JSON.stringify(newBundle.documentIds || []),
        newBundle.status || 'ACTIVE', newBundle.qrCode, newBundle.barcode, JSON.stringify(newBundle.tags || [])
      ]);

      if (newBundle.documentIds && newBundle.documentIds.length > 0) {
        await client.query(`
          UPDATE documents 
          SET bundle_id = $1, bundle_number = $2, bundle_title = $3, updated_at = NOW()
          WHERE id = ANY($4::text[])
        `, [newBundle.id, newBundle.bundleNumber, newBundle.title, newBundle.documentIds]);
      }

      if (user) {
        await client.query(`
          INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          'aud-' + Date.now(), user.id, user.fullName, user.role, 'BUNDLE_CREATED',
          'BUNDLE', newBundle.id, newBundle.title, `Created bundle dossier ${newBundle.bundleNumber} containing ${newBundle.documentIds.length} document(s)`
        ]);
      }

      await client.query('COMMIT');
      return newBundle;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] createBundle DB query failed, using memory state:', err);
    memoryBundles.unshift(newBundle);
    if (newBundle.documentIds && newBundle.documentIds.length > 0) {
      memoryDocuments = memoryDocuments.map(d => {
        if (newBundle.documentIds.includes(d.id)) {
          return { ...d, bundleId: newBundle.id, bundleNumber: newBundle.bundleNumber, bundleTitle: newBundle.title, updatedAt: now };
        }
        return d;
      });
    }
    return newBundle;
  }
}

export async function updateBundle(id: string, updates: Partial<DocumentBundle>, user?: User): Promise<void> {
  const now = new Date().toISOString();
  if (!isDbAvailable()) {
    memoryBundles = memoryBundles.map(b => b.id === id ? { ...b, ...updates, updatedAt: now } : b);
    return;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.imageUrl !== undefined) { fields.push(`image_url = $${idx++}`); values.push(updates.imageUrl); }
    if (updates.departmentId !== undefined) { fields.push(`department_id = $${idx++}`); values.push(updates.departmentId); }
    if (updates.departmentName !== undefined) { fields.push(`department_name = $${idx++}`); values.push(updates.departmentName); }
    if (updates.locationId !== undefined) { fields.push(`location_id = $${idx++}`); values.push(updates.locationId); }
    if (updates.locationPath !== undefined) { fields.push(`location_path = $${idx++}`); values.push(updates.locationPath); }
    if (updates.documentIds !== undefined) { fields.push(`document_ids = $${idx++}`); values.push(JSON.stringify(updates.documentIds)); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(JSON.stringify(updates.tags)); }

    fields.push(`updated_at = NOW()`);

    if (fields.length > 0) {
      values.push(id);
      await pgPool!.query(`UPDATE bundles SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
  } catch (err) {
    console.warn('[Repository] updateBundle DB query failed, updating memory:', err);
    memoryBundles = memoryBundles.map(b => b.id === id ? { ...b, ...updates, updatedAt: now } : b);
  }
}

export async function deleteBundle(id: string, user?: User): Promise<void> {
  if (!isDbAvailable()) {
    memoryBundles = memoryBundles.filter(b => b.id !== id);
    memoryDocuments = memoryDocuments.map(d => d.bundleId === id ? { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined } : d);
    return;
  }

  try {
    const client = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE documents SET bundle_id = NULL, bundle_number = NULL, bundle_title = NULL WHERE bundle_id = $1', [id]);
      await client.query('DELETE FROM bundles WHERE id = $1', [id]);
      if (user) {
        await client.query(`
          INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          'aud-' + Date.now(), user.id, user.fullName, user.role, 'BUNDLE_DELETED',
          'BUNDLE', id, `Bundle #${id}`, `Deleted bundle dossier #${id} and unlinked documents.`
        ]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[Repository] deleteBundle DB query failed, updating memory:', err);
    memoryBundles = memoryBundles.filter(b => b.id !== id);
    memoryDocuments = memoryDocuments.map(d => d.bundleId === id ? { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined } : d);
  }
}

export async function addDocumentsToBundle(bundleId: string, docIds: string[], user?: User): Promise<void> {
  const bundles = await getBundles();
  const targetBundle = bundles.find(b => b.id === bundleId);
  if (!targetBundle) throw new Error('Bundle not found');

  const newDocIds = Array.from(new Set([...targetBundle.documentIds, ...docIds]));
  await updateBundle(bundleId, { documentIds: newDocIds }, user);

  if (!isDbAvailable()) {
    memoryDocuments = memoryDocuments.map(d => {
      if (docIds.includes(d.id)) {
        return { ...d, bundleId: targetBundle.id, bundleNumber: targetBundle.bundleNumber, bundleTitle: targetBundle.title };
      }
      return d;
    });
    return;
  }

  try {
    await pgPool!.query(`
      UPDATE documents 
      SET bundle_id = $1, bundle_number = $2, bundle_title = $3, updated_at = NOW()
      WHERE id = ANY($4::text[])
    `, [targetBundle.id, targetBundle.bundleNumber, targetBundle.title, docIds]);
  } catch (err) {
    console.warn('[Repository] addDocumentsToBundle DB query failed, updating memory:', err);
    memoryDocuments = memoryDocuments.map(d => {
      if (docIds.includes(d.id)) {
        return { ...d, bundleId: targetBundle.id, bundleNumber: targetBundle.bundleNumber, bundleTitle: targetBundle.title };
      }
      return d;
    });
  }
}

export async function removeDocumentFromBundle(bundleId: string, docId: string, user?: User): Promise<void> {
  const bundles = await getBundles();
  const targetBundle = bundles.find(b => b.id === bundleId);
  if (!targetBundle) return;

  const newDocIds = targetBundle.documentIds.filter(id => id !== docId);
  await updateBundle(bundleId, { documentIds: newDocIds }, user);

  if (!isDbAvailable()) {
    memoryDocuments = memoryDocuments.map(d => {
      if (d.id === docId && d.bundleId === bundleId) {
        return { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined };
      }
      return d;
    });
    return;
  }

  try {
    await pgPool!.query(`
      UPDATE documents 
      SET bundle_id = NULL, bundle_number = NULL, bundle_title = NULL, updated_at = NOW()
      WHERE id = $1
    `, [docId]);
  } catch (err) {
    console.warn('[Repository] removeDocumentFromBundle DB query failed, updating memory:', err);
    memoryDocuments = memoryDocuments.map(d => {
      if (d.id === docId && d.bundleId === bundleId) {
        return { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined };
      }
      return d;
    });
  }
}

// --- DATA BACKUP & RESTORE ---
// Whitelisted table set: export dumps and import restores operate only on these
// tables, always using raw snake_case rows (the canonical storage format).
export const BACKUP_TABLES = [
  'departments',
  'users',
  'document_types',
  'reusable_custom_fields',
  'locations',
  'documents',
  'bundles',
  'checkouts',
  'movements',
  'retention_policies',
  'disposal_records',
  'audit_logs'
] as const;

export interface BackupPayload {
  format: 'archivehub-export';
  version: number;
  exportedAt: string;
  tables: Record<string, any[]>;
}

export async function exportAllData(): Promise<BackupPayload> {
  if (!isDbAvailable()) {
    throw new Error('Data export requires a connected PostgreSQL database. The server is currently running in memory fallback mode.');
  }

  const tables: Record<string, any[]> = {};
  for (const table of BACKUP_TABLES) {
    const res = await pgPool!.query(`SELECT * FROM ${table}`);
    tables[table] = res.rows;
  }

  return {
    format: 'archivehub-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables
  };
}

export async function importAllData(payload: any): Promise<Record<string, number>> {
  if (!isDbAvailable()) {
    throw new Error('Data import requires a connected PostgreSQL database. The server is currently running in memory fallback mode.');
  }

  if (!payload || payload.format !== 'archivehub-export' || typeof payload.tables !== 'object' || payload.tables === null) {
    throw new Error('Invalid backup file: expected an ArchiveHub export JSON produced by "Export Full Backup".');
  }

  const counts: Record<string, number> = {};
  const client = await pgPool!.connect();
  try {
    // Full restore runs as one transaction: either every table is replaced or nothing changes.
    await client.query('BEGIN');

    for (const table of BACKUP_TABLES) {
      await client.query(`DELETE FROM ${table}`);

      const rows = Array.isArray(payload.tables[table]) ? payload.tables[table] : [];
      counts[table] = rows.length;
      if (rows.length === 0) continue;

      // Insert only columns that actually exist on the table (extra keys in the file are ignored)
      const probe = await client.query(`SELECT * FROM ${table} LIMIT 0`);
      const cols = probe.fields.map(f => f.name);
      // pg type OIDs: json = 114, jsonb = 3802. Values for these columns must be sent
      // as serialized JSON text (scalar JSON values cannot round-trip as raw params).
      const jsonCols = new Set(probe.fields.filter(f => f.dataTypeID === 114 || f.dataTypeID === 3802).map(f => f.name));

      // Chunked multi-row insert to stay comfortably under the driver parameter limit
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const values: any[] = [];
        const rowPlaceholders: string[] = [];
        let idx = 1;
        for (const row of chunk) {
          const ph: string[] = [];
          for (const c of cols) {
            ph.push(`$${idx++}`);
            const raw = row && typeof row === 'object' && (row as any)[c] !== undefined ? (row as any)[c] : null;
            values.push(jsonCols.has(c) && raw !== null ? JSON.stringify(raw) : raw);
          }
          rowPlaceholders.push(`(${ph.join(', ')})`);
        }
        await client.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`,
          values
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return counts;
}
