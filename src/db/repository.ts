import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool, pgPool } from './index.js';
import { 
  User, 
  Department, 
  DocumentTypeInfo, 
  LocationItem, 
  DocumentItem, 
  NewDocumentItem,
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
import { storeDocumentPhotos, deleteDocumentFiles } from '../files/documentPhotos.js';

// DB mode is authoritative: when a pool is configured, failed queries throw so
// the API reports the failure instead of silently acknowledging lost writes.
// The in-memory arrays below serve ONLY the explicit no-database demo mode.

/** Allocate a collision-free numeric barcode, retrying against stored values. */
async function generateUniqueBarcode(table: 'documents' | 'locations' | 'bundles', prefix: string, digits: number): Promise<string> {
  const memoryPool = table === 'documents' ? memoryDocuments : table === 'locations' ? memoryLocations : memoryBundles;
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = prefix + String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, '0');
    if (!isDbAvailable()) {
      if (!memoryPool.some(item => item.barcode === candidate)) return candidate;
      continue;
    }
    const res = await pgPool!.query(`SELECT 1 FROM ${table} WHERE barcode = $1 LIMIT 1`, [candidate]);
    if (res.rows.length === 0) return candidate;
  }
  throw new Error('Could not allocate a unique barcode. Please retry.');
}

/** Recompute occupancy counters for the given locations from live document rows. */
async function refreshOccupancy(client: PoolClient, locationIds: Array<string | null | undefined>): Promise<void> {
  const ids = [...new Set(locationIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  await client.query(
    `UPDATE locations SET current_occupancy = (
       SELECT COUNT(*) FROM documents d WHERE d.current_location_id = locations.id
     ) WHERE id = ANY($1::text[])`,
    [ids]
  );
}

function refreshMemoryOccupancy(): void {
  memoryLocations = memoryLocations.map(l => ({
    ...l,
    currentOccupancy: memoryDocuments.filter(d => d.currentLocationId === l.id).length
  }));
}

/** DATE columns arrive as Date objects; normalize back to YYYY-MM-DD strings. */
function dateStr(value: any): any {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

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
    title: r.title || '',
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
let memoryDisposalRecords: DisposalRecord[] = [];

function isDbAvailable(): boolean {
  return Boolean(getPool());
}

// --- DISPOSAL RECORDS REPOSITORY ---
export async function getDisposals(): Promise<DisposalRecord[]> {
  if (!isDbAvailable()) return memoryDisposalRecords;
  const res = await pgPool!.query('SELECT * FROM disposal_records ORDER BY disposal_date DESC');
  return res.rows.map(r => ({
    id: r.id,
    documentId: r.document_id,
    documentNumber: r.document_number,
    documentTitle: r.document_title,
    requestedByUserName: r.requested_by_user_name,
    approvedByUserName: r.approved_by_user_name,
    disposalDate: dateStr(r.disposal_date),
    disposalMethod: r.disposal_method,
    certificateNumber: r.certificate_number,
    witnessName: r.witness_name,
    notes: r.notes
  }));
}

// --- USERS REPOSITORY ---
export async function getUsers(): Promise<User[]> {
  if (!isDbAvailable()) return memoryUsers;
  const res = await pgPool!.query('SELECT * FROM users ORDER BY created_at ASC');
  return res.rows.map(mapUserRow);
}

export async function getUserById(id: string): Promise<User | null> {
  if (!isDbAvailable()) {
    return memoryUsers.find(u => u.id === id) || null;
  }
  const res = await pgPool!.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  if (res.rows.length === 0) return null;
  return mapUserRow(res.rows[0]);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isDbAvailable()) {
    return memoryUsers.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }
  const res = await pgPool!.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
  if (res.rows.length === 0) return null;
  return mapUserRow(res.rows[0]);
}

export async function createUser(userData: Omit<User, 'id'> & { id?: string }): Promise<User> {
  const id = userData.id || 'usr-reg-' + randomUUID();
  const rawPassword = userData.password;
  if (!rawPassword || rawPassword.length < 8) {
    throw new Error('A password of at least 8 characters is required.');
  }
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

  const res = await pgPool!.query(
    'UPDATE users SET approval_status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  if (res.rows.length === 0) return userInMemory || null;
  return mapUserRow(res.rows[0]);
}

export async function updateUserPassword(id: string, hashedPassword: string): Promise<void> {
  const userInMemory = memoryUsers.find(u => u.id === id);
  if (userInMemory) userInMemory.password = hashedPassword;
  if (!isDbAvailable()) return;
  await pgPool!.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
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
    console.error('[Repository] updateUser failed:', err);
    throw err;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!isDbAvailable()) {
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    return true;
  }
  await pgPool!.query('DELETE FROM users WHERE id = $1', [id]);
  return true;
}

// --- DEPARTMENTS REPOSITORY ---
export async function getDepartments(): Promise<Department[]> {
  if (!isDbAvailable()) return memoryDepartments;
  const res = await pgPool!.query('SELECT * FROM departments ORDER BY name ASC');
  return res.rows.map(r => ({
    id: r.id,
    code: r.code,
    name: r.name,
    headName: r.head_name,
    documentCount: r.document_count
  }));
}

export async function createDepartment(deptData: Omit<Department, 'id' | 'documentCount'>): Promise<Department> {
  const id = 'dept-' + randomUUID();
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

  await pgPool!.query(
    'INSERT INTO departments (id, code, name, head_name, document_count) VALUES ($1, $2, $3, $4, 0)',
    [newDept.id, newDept.code, newDept.name, newDept.headName]
  );

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
    console.error('[Repository] updateDepartment failed:', err);
    throw err;
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

  await pgPool!.query('DELETE FROM departments WHERE id = $1', [id]);
}

// --- DOCUMENT TYPES REPOSITORY ---
export async function getDocumentTypes(): Promise<DocumentTypeInfo[]> {
  if (!isDbAvailable()) return memoryDocumentTypes;
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
}

export async function createDocumentType(dtData: Omit<DocumentTypeInfo, 'id'>): Promise<DocumentTypeInfo> {
  const id = 'dt-' + randomUUID();
  const newType: DocumentTypeInfo = { ...dtData, id };

  if (!isDbAvailable()) {
    memoryDocumentTypes.push(newType);
    return newType;
  }

  await pgPool!.query(`
    INSERT INTO document_types (id, code, name, retention_years, description, department_id, department_name, custom_fields)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [newType.id, newType.code, newType.name, newType.retentionYears, newType.description, newType.departmentId || null, newType.departmentName || null, JSON.stringify(newType.customFields || [])]);

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
    console.error('[Repository] updateDocumentType failed:', err);
    throw err;
  }
}

export async function deleteDocumentType(id: string): Promise<void> {
  if (!isDbAvailable()) {
    memoryDocumentTypes = memoryDocumentTypes.filter(d => d.id !== id);
    return;
  }
  await pgPool!.query('DELETE FROM document_types WHERE id = $1', [id]);
}

// --- LOCATIONS REPOSITORY ---
export async function getLocations(): Promise<LocationItem[]> {
  if (!isDbAvailable()) return memoryLocations;
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
}

export async function createLocation(locData: Omit<LocationItem, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode' | 'currentOccupancy'>): Promise<LocationItem> {
  const id = 'loc-' + locData.type.toLowerCase() + '-' + randomUUID();
  const code = locData.code || locData.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
  const newLoc: LocationItem = {
    ...locData,
    id,
    code,
    capacity: locData.capacity || 20,
    currentOccupancy: 0,
    qrCode: 'LOC-' + code,
    barcode: await generateUniqueBarcode('locations', '', 7),
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0]
  };

  if (!isDbAvailable()) {
    memoryLocations.push(newLoc);
    return newLoc;
  }

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
    console.error('[Repository] updateLocation failed:', err);
    throw err;
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

  const childCheck = await pgPool!.query('SELECT COUNT(*) FROM locations WHERE parent_id = $1', [id]);
  const docCheck = await pgPool!.query('SELECT COUNT(*) FROM documents WHERE home_location_id = $1 OR current_location_id = $1', [id]);

  if (parseInt(childCheck.rows[0].count, 10) > 0 || parseInt(docCheck.rows[0].count, 10) > 0) {
    return false;
  }

  await pgPool!.query('DELETE FROM locations WHERE id = $1', [id]);
  return true;
}

// --- DOCUMENTS REPOSITORY ---
function mapDocumentRow(r: any): DocumentItem {
  return {
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
      photos: Array.isArray(r.photos) ? r.photos : [],
      qrClaimed: r.qr_claimed === true || r.qr_claimed === 'true',
      qrClaimedAt: r.qr_claimed_at ? new Date(r.qr_claimed_at).toISOString() : null,
      qrClaimedBy: r.qr_claimed_by || null,
      documentDate: dateStr(r.document_date),
      receivedDate: dateStr(r.received_date),
      filedDate: dateStr(r.filed_date),
      retentionStartDate: dateStr(r.retention_start_date),
      retentionEndDate: dateStr(r.retention_end_date),
      disposalDate: dateStr(r.disposal_date),
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
  };
}

export async function getDocumentById(id: string): Promise<DocumentItem | null> {
  if (!isDbAvailable()) return memoryDocuments.find(d => d.id === id) || null;
  const res = await pgPool!.query('SELECT * FROM documents WHERE id = $1 LIMIT 1', [id]);
  return res.rows.length > 0 ? mapDocumentRow(res.rows[0]) : null;
}

export async function getDocuments(): Promise<DocumentItem[]> {
  if (!isDbAvailable()) return memoryDocuments;
  const res = await pgPool!.query('SELECT * FROM documents ORDER BY created_at DESC');
  return res.rows.map(mapDocumentRow);
}

/** Paginated registry read for large collections; returns the page + total count. */
export async function getDocumentsPage(limit: number, offset: number): Promise<{ items: DocumentItem[]; total: number }> {
  if (!isDbAvailable()) {
    return { items: memoryDocuments.slice(offset, offset + limit), total: memoryDocuments.length };
  }
  const [rows, count] = await Promise.all([
    pgPool!.query('SELECT * FROM documents ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
    pgPool!.query('SELECT COUNT(*)::int AS total FROM documents')
  ]);
  return { items: rows.rows.map(mapDocumentRow), total: count.rows[0].total };
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

export async function createDocument(docData: NewDocumentItem, user: User, homePath: string): Promise<DocumentItem> {
  const id = 'doc-' + randomUUID();
  // Blank document number = auto-generate from department code + type code
  const autoGenerate = !docData.documentNumber?.trim();
  const documentNumber = docData.documentNumber?.trim() || await generateDocumentNumber(docData.departmentId, docData.documentTypeId);
  const qrCode = 'DOC-' + documentNumber;
  const barcode = await generateUniqueBarcode('documents', '884', 6);

  const newDoc: DocumentItem = {
    ...docData,
    documentNumber,
    id,
    currentLocationId: docData.homeLocationId,
    status: docData.status || 'AVAILABLE',
    qrCode,
    barcode,
    photos: docData.photos || [],
    qrClaimed: false,
    qrClaimedAt: null,
    qrClaimedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!isDbAvailable()) {
    memoryDocuments.unshift(newDoc);
    refreshMemoryOccupancy();
    // Movement
    memoryMovements.unshift({
      id: 'mvt-' + randomUUID(),
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
      id: 'aud-' + randomUUID(),
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

  // Offload base64 photo payloads to disk; the row keeps only file references.
  newDoc.photos = storeDocumentPhotos(id, newDoc.photos || []);

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
          qr_code, barcode, photos, qr_claimed, qr_claimed_at, qr_claimed_by,
          document_date, received_date, filed_date, retention_start_date,
          retention_end_date, disposal_date, has_digital_copy, digital_file_name, digital_file_size,
          digital_file_type, digital_file_version, custom_metadata, custom_field_values, condition_notes,
          bundle_id, bundle_number, bundle_title
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39
        )
      `, [
        newDoc.id, newDoc.documentNumber, newDoc.referenceNumber, newDoc.title, newDoc.documentTypeId, newDoc.documentTypeName,
        newDoc.subject || null, newDoc.description || null, newDoc.departmentId, newDoc.departmentName, newDoc.custodianName,
        newDoc.homeLocationId, newDoc.currentLocationId, newDoc.status, newDoc.confidentiality, newDoc.condition,
        newDoc.qrCode, newDoc.barcode, JSON.stringify(newDoc.photos || []), newDoc.qrClaimed, newDoc.qrClaimedAt || null, newDoc.qrClaimedBy || null,
        newDoc.documentDate || null, newDoc.receivedDate || null, newDoc.filedDate || null, newDoc.retentionStartDate || null,
        newDoc.retentionEndDate || null, newDoc.disposalDate || null, newDoc.hasDigitalCopy, newDoc.digitalFileName || null, newDoc.digitalFileSize || null,
        newDoc.digitalFileType || null, newDoc.digitalFileVersion || 1, JSON.stringify(newDoc.customMetadata || []), JSON.stringify(newDoc.customFieldValues || {}), newDoc.conditionNotes || null,
        newDoc.bundleId || null, newDoc.bundleNumber || null, newDoc.bundleTitle || null
      ]);

        // Initial Filing Movement
        await client.query(`
        INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        'mvt-' + randomUUID(), id, newDoc.documentNumber, newDoc.title, docData.homeLocationId,
        'Registration Desk Staging', docData.homeLocationId, homePath, 'INITIAL_FILING',
        user.id, user.fullName, 'Initial Registration & Physical Filing'
      ]);

        // Audit Log
        await client.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'aud-' + randomUUID(), user.id, user.fullName, user.role, 'DOCUMENT_REGISTERED',
        'DOCUMENT', id, newDoc.title, `Registered record #${newDoc.documentNumber} into home archive location: ${homePath}`
      ]);

        await refreshOccupancy(client, [docData.homeLocationId]);

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
      console.error('[Repository] createDocument DB transaction failed:', err);
      throw err;
    }
  }

  // Unreachable — the loop above always returns
  return newDoc;
}

/** Shared SET-clause builder for single and bulk document updates. */
function documentUpdateAssignments(updates: Partial<DocumentItem>, startIdx: number): { fields: string[]; values: any[]; nextIdx: number } {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = startIdx;

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
  if (updates.documentDate !== undefined) { fields.push(`document_date = $${idx++}`); values.push(updates.documentDate || null); }
  if (updates.receivedDate !== undefined) { fields.push(`received_date = $${idx++}`); values.push(updates.receivedDate || null); }
  if (updates.filedDate !== undefined) { fields.push(`filed_date = $${idx++}`); values.push(updates.filedDate || null); }
  if (updates.retentionStartDate !== undefined) { fields.push(`retention_start_date = $${idx++}`); values.push(updates.retentionStartDate || null); }
  if (updates.retentionEndDate !== undefined) { fields.push(`retention_end_date = $${idx++}`); values.push(updates.retentionEndDate || null); }
  if (updates.disposalDate !== undefined) { fields.push(`disposal_date = $${idx++}`); values.push(updates.disposalDate || null); }
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
  if (updates.photos !== undefined) { fields.push(`photos = $${idx++}`); values.push(JSON.stringify(updates.photos)); }
  if (updates.qrClaimed !== undefined) { fields.push(`qr_claimed = $${idx++}`); values.push(updates.qrClaimed); }
  if (updates.qrClaimedAt !== undefined) { fields.push(`qr_claimed_at = $${idx++}`); values.push(updates.qrClaimedAt); }
  if (updates.qrClaimedBy !== undefined) { fields.push(`qr_claimed_by = $${idx++}`); values.push(updates.qrClaimedBy); }

  return { fields, values, nextIdx: idx };
}

export async function updateDocument(id: string, updates: Partial<DocumentItem>, user: User): Promise<void> {
  // Offload any new base64 photos before persisting the metadata row.
  if (updates.photos !== undefined) {
    updates = { ...updates, photos: storeDocumentPhotos(id, updates.photos) };
  }

  if (!isDbAvailable()) {
    const existingDoc = memoryDocuments.find(d => d.id === id);
    if (!existingDoc) throw new Error('Document not found.');
    const docTitle = updates.title || existingDoc.title;
    const docNumber = updates.documentNumber || existingDoc.documentNumber;
    const now = new Date().toISOString();
    memoryDocuments = memoryDocuments.map(d => d.id === id ? { ...d, ...updates, updatedAt: now } : d);

    // Keep bundle membership lists in sync in demo mode too
    if (updates.bundleId !== undefined && updates.bundleId !== existingDoc.bundleId) {
      if (existingDoc.bundleId) {
        memoryBundles = memoryBundles.map(b => b.id === existingDoc.bundleId
          ? { ...b, documentIds: b.documentIds.filter(docId => docId !== id), updatedAt: now }
          : b);
      }
      if (updates.bundleId) {
        const bundle = memoryBundles.find(b => b.id === updates.bundleId);
        if (!bundle) throw new Error('Target bundle not found.');
        memoryBundles = memoryBundles.map(b => b.id === bundle.id
          ? { ...b, documentIds: Array.from(new Set([...b.documentIds, id])), updatedAt: now }
          : b);
        memoryDocuments = memoryDocuments.map(d => d.id === id ? { ...d, bundleNumber: bundle.bundleNumber, bundleTitle: bundle.title } : d);
      } else {
        memoryDocuments = memoryDocuments.map(d => d.id === id ? { ...d, bundleNumber: undefined, bundleTitle: undefined } : d);
      }
    }

    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'DOCUMENT_UPDATED',
      entityType: 'DOCUMENT',
      entityId: id,
      entityName: docTitle,
      timestamp: now,
      details: `Updated metadata and attributes for document #${docNumber}`
    });
    refreshMemoryOccupancy();
    return;
  }

  const existingDoc = memoryDocuments.find(d => d.id === id);
  const docTitle = updates.title || existingDoc?.title || 'Document Record';
  const docNumber = updates.documentNumber || existingDoc?.documentNumber || id;

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');

    // Lock the row when membership or position changes need the previous values.
    let previousBundleId: string | null = null;
    let previousLocationId: string | null = null;
    if (updates.bundleId !== undefined || updates.currentLocationId !== undefined || updates.homeLocationId !== undefined) {
      const cur = await client.query('SELECT bundle_id, current_location_id FROM documents WHERE id = $1 FOR UPDATE', [id]);
      if (cur.rows.length === 0) throw new Error('Document not found.');
      previousBundleId = cur.rows[0].bundle_id;
      previousLocationId = cur.rows[0].current_location_id;
    }

    const { fields, values, nextIdx } = documentUpdateAssignments(updates, 1);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    await client.query(`UPDATE documents SET ${fields.join(', ')} WHERE id = $${nextIdx}`, values);

    // Keep bundles.document_ids and the denormalized bundle labels in sync.
    if (updates.bundleId !== undefined && updates.bundleId !== previousBundleId) {
      if (previousBundleId) {
        await client.query(
          `UPDATE bundles SET document_ids = COALESCE(
             (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(document_ids) elem WHERE elem <> $1),
             '[]'::jsonb
           ), updated_at = NOW() WHERE id = $2`,
          [id, previousBundleId]
        );
      }
      if (updates.bundleId) {
        const bundleRes = await client.query('SELECT bundle_number, title, document_ids FROM bundles WHERE id = $1', [updates.bundleId]);
        if (bundleRes.rows.length === 0) throw new Error('Target bundle not found.');
        const memberIds = toStringArray(bundleRes.rows[0].document_ids);
        if (!memberIds.includes(id)) memberIds.push(id);
        await client.query('UPDATE bundles SET document_ids = $1::jsonb, updated_at = NOW() WHERE id = $2', [JSON.stringify(memberIds), updates.bundleId]);
        await client.query('UPDATE documents SET bundle_number = $1, bundle_title = $2 WHERE id = $3', [bundleRes.rows[0].bundle_number, bundleRes.rows[0].title, id]);
      } else {
        await client.query('UPDATE documents SET bundle_number = NULL, bundle_title = NULL WHERE id = $1', [id]);
      }
    }

    await refreshOccupancy(client, [previousLocationId, updates.currentLocationId, updates.homeLocationId]);

    // Audit Log in PostgreSQL
    await client.query(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      'aud-' + randomUUID(), user.id, user.fullName, user.role, 'DOCUMENT_UPDATED',
      'DOCUMENT', id, docTitle, `Updated metadata and attributes for document #${docNumber}`
    ]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Repository] updateDocument failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function claimDocumentQr(documentId: string, user: User): Promise<{ success: boolean; message?: string; claimedAt?: string }> {
  const now = new Date().toISOString();

  if (!isDbAvailable()) {
    const existingDoc = memoryDocuments.find(d => d.id === documentId);
    if (!existingDoc) return { success: false, message: 'Document not found.' };
    if (existingDoc.qrClaimed) {
      return { success: false, message: `QR code for document #${existingDoc.documentNumber} is already claimed.` };
    }
    memoryDocuments = memoryDocuments.map(d =>
      d.id === documentId
        ? { ...d, qrClaimed: true, qrClaimedAt: now, qrClaimedBy: user.id, updatedAt: now }
        : d
    );
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'QR_CODE_CLAIMED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      entityName: existingDoc.documentNumber,
      timestamp: now,
      details: `QR code scanned/claimed for document #${existingDoc.documentNumber}`
    });
    return { success: true, message: `QR code claimed for document #${existingDoc.documentNumber}.`, claimedAt: now };
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    // Atomic claim: the UPDATE only matches unclaimed rows, so two concurrent
    // scans can never both claim the same label.
    const res = await client.query(
      `UPDATE documents
       SET qr_claimed = TRUE, qr_claimed_at = NOW(), qr_claimed_by = $1, updated_at = NOW()
       WHERE id = $2 AND qr_claimed = FALSE
       RETURNING document_number, qr_claimed_at`,
      [user.id, documentId]
    );
    if (res.rows.length === 0) {
      const check = await client.query('SELECT document_number, qr_claimed FROM documents WHERE id = $1', [documentId]);
      await client.query('ROLLBACK');
      if (check.rows.length === 0) return { success: false, message: 'Document not found.' };
      return { success: false, message: `QR code for document #${check.rows[0].document_number} is already claimed.` };
    }
    const documentNumber = res.rows[0].document_number;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'QR_CODE_CLAIMED', 'DOCUMENT', documentId, documentNumber, `QR code scanned/claimed for document #${documentNumber}`]
    );
    await client.query('COMMIT');
    return {
      success: true,
      message: `QR code claimed for document #${documentNumber}.`,
      claimedAt: new Date(res.rows[0].qr_claimed_at).toISOString()
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function unclaimDocumentQr(documentId: string, user: User): Promise<{ success: boolean; message?: string }> {
  const now = new Date().toISOString();

  if (!isDbAvailable()) {
    const existingDoc = memoryDocuments.find(d => d.id === documentId);
    if (!existingDoc) return { success: false, message: 'Document not found.' };
    if (!existingDoc.qrClaimed) {
      return { success: false, message: `QR code for document #${existingDoc.documentNumber} is not currently claimed.` };
    }
    memoryDocuments = memoryDocuments.map(d =>
      d.id === documentId
        ? { ...d, qrClaimed: false, qrClaimedAt: null, qrClaimedBy: null, updatedAt: now }
        : d
    );
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'QR_CODE_UNCLAIMED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      entityName: existingDoc.documentNumber,
      timestamp: now,
      details: `QR code claim reset for document #${existingDoc.documentNumber}`
    });
    return { success: true, message: `QR code claim reset for document #${existingDoc.documentNumber}.` };
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE documents
       SET qr_claimed = FALSE, qr_claimed_at = NULL, qr_claimed_by = NULL, updated_at = NOW()
       WHERE id = $1 AND qr_claimed = TRUE
       RETURNING document_number`,
      [documentId]
    );
    if (res.rows.length === 0) {
      const check = await client.query('SELECT document_number FROM documents WHERE id = $1', [documentId]);
      await client.query('ROLLBACK');
      if (check.rows.length === 0) return { success: false, message: 'Document not found.' };
      return { success: false, message: `QR code for document #${check.rows[0].document_number} is not currently claimed.` };
    }
    const documentNumber = res.rows[0].document_number;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'QR_CODE_UNCLAIMED', 'DOCUMENT', documentId, documentNumber, `QR code claim reset for document #${documentNumber}`]
    );
    await client.query('COMMIT');
    return { success: true, message: `QR code claim reset for document #${documentNumber}.` };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteDocument(id: string, user: User): Promise<boolean> {
  const now = new Date().toISOString();
  const disposalDate = now.slice(0, 10);
  const certificateNumber = 'DEL-' + randomUUID().slice(0, 8).toUpperCase();

  if (!isDbAvailable()) {
    const doc = memoryDocuments.find(d => d.id === id);
    if (!doc || doc.status === 'CHECKED_OUT') return false;
    memoryDisposalRecords.unshift({
      id: 'disp-' + randomUUID(),
      documentId: id,
      documentNumber: doc.documentNumber,
      documentTitle: doc.title,
      requestedByUserName: user.fullName,
      approvedByUserName: user.fullName,
      disposalDate,
      disposalMethod: 'ADMIN_DELETION',
      certificateNumber,
      witnessName: user.fullName,
      notes: 'Record removed from the archive registry.'
    });
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'DOCUMENT_DELETED',
      entityType: 'DOCUMENT',
      entityId: id,
      entityName: doc.documentNumber,
      timestamp: now,
      details: `Deleted document #${doc.documentNumber} (${doc.title}). Disposal certificate ${certificateNumber}.`
    });
    memoryDocuments = memoryDocuments.filter(d => d.id !== id);
    refreshMemoryOccupancy();
    deleteDocumentFiles(id);
    return true;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [id]);
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    const doc = res.rows[0];
    if (doc.status === 'CHECKED_OUT') {
      await client.query('ROLLBACK');
      return false;
    }

    // Deletion leaves an auditable disposal trail instead of vanishing silently.
    await client.query(
      `INSERT INTO disposal_records (id, document_id, document_number, document_title, requested_by_user_name, approved_by_user_name, disposal_date, disposal_method, certificate_number, witness_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['disp-' + randomUUID(), id, doc.document_number, doc.title, user.fullName, user.fullName, disposalDate, 'ADMIN_DELETION', certificateNumber, user.fullName, 'Record removed from the archive registry.']
    );
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'DOCUMENT_DELETED', 'DOCUMENT', id, doc.document_number, `Deleted document #${doc.document_number} (${doc.title}). Disposal certificate ${certificateNumber}.`]
    );
    await client.query('DELETE FROM documents WHERE id = $1', [id]);
    await refreshOccupancy(client, [doc.current_location_id, doc.home_location_id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  deleteDocumentFiles(id);
  return true;
}

export async function moveDocument(documentId: string, toLocationId: string, reason: string, user: User, fromPath: string, toPath: string): Promise<void> {
  if (!isDbAvailable()) {
    const doc = memoryDocuments.find(d => d.id === documentId);
    if (!doc) throw new Error('Document not found');
    const previousLocationId = doc.currentLocationId;
    memoryDocuments = memoryDocuments.map(d => d.id === documentId ? { ...d, currentLocationId: toLocationId, updatedAt: new Date().toISOString() } : d);
    memoryMovements.unshift({
      id: 'mvt-' + randomUUID(),
      documentId,
      documentNumber: doc.documentNumber,
      documentTitle: doc.title,
      fromLocationId: previousLocationId,
      fromLocationPath: fromPath,
      toLocationId,
      toLocationPath: toPath,
      movementType: 'RELOCATION',
      performedByUserId: user.id,
      performedByUserName: user.fullName,
      reason: reason || 'Physical Relocation Transfer',
      timestamp: new Date().toISOString()
    });
    refreshMemoryOccupancy();
    return;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');

    const docRes = await client.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [documentId]);
    if (docRes.rows.length === 0) throw new Error('Document not found');
    const doc = docRes.rows[0];

    await client.query('UPDATE documents SET current_location_id = $1, updated_at = NOW() WHERE id = $2', [toLocationId, documentId]);

    await client.query(`
      INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      'mvt-' + randomUUID(), documentId, doc.document_number, doc.title, doc.current_location_id,
      fromPath, toLocationId, toPath, 'RELOCATION', user.id, user.fullName, reason || 'Physical Relocation'
    ]);

    await client.query(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      'aud-' + randomUUID(), user.id, user.fullName, user.role, 'DOCUMENT_MOVED',
      'DOCUMENT', documentId, doc.title, `Relocated record from [${fromPath}] to [${toPath}]. Reason: ${reason}`
    ]);

    await refreshOccupancy(client, [doc.current_location_id, toLocationId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// --- CHECKOUTS REPOSITORY ---
const ACTIVE_CHECKOUT_STATUSES = ['REQUESTED', 'APPROVED', 'CHECKED_OUT', 'OVERDUE'];

export async function getCheckouts(): Promise<CheckoutRecord[]> {
  if (!isDbAvailable()) return memoryCheckouts;
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
    requestDate: dateStr(r.request_date),
    checkoutDate: dateStr(r.checkout_date),
    dueDate: dateStr(r.due_date),
    returnDate: dateStr(r.return_date),
    status: r.status,
    purpose: r.purpose,
    conditionOut: r.condition_out,
    conditionIn: r.condition_in,
    notes: r.notes
  }));
}

export async function requestCheckout(documentId: string, purpose: string, dueDate: string, user: User): Promise<CheckoutRecord> {
  const requestDate = new Date().toISOString().split('T')[0];

  if (!isDbAvailable()) {
    const doc = memoryDocuments.find(d => d.id === documentId);
    if (!doc) throw new Error('Document not found');
    if (doc.status !== 'AVAILABLE') throw new Error(`Document #${doc.documentNumber} is not available for checkout (status: ${doc.status}).`);
    if (memoryCheckouts.some(c => c.documentId === documentId && ACTIVE_CHECKOUT_STATUSES.includes(c.status))) {
      throw new Error('An active checkout already exists for this document.');
    }
    const newChk: CheckoutRecord = {
      id: 'chk-' + randomUUID(),
      documentId,
      documentNumber: doc.documentNumber,
      documentTitle: doc.title,
      requestedByUserId: user.id,
      requestedByUserName: user.fullName,
      requestedByDepartment: user.departmentName,
      requestDate,
      dueDate,
      status: 'REQUESTED',
      purpose,
      conditionOut: doc.condition
    };
    memoryCheckouts.unshift(newChk);
    memoryDocuments = memoryDocuments.map(d => d.id === documentId ? { ...d, status: 'REQUESTED' } : d);
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
      action: 'CHECKOUT_REQUESTED', entityType: 'DOCUMENT', entityId: documentId, entityName: doc.documentNumber,
      timestamp: new Date().toISOString(), details: `Checkout requested for document #${doc.documentNumber}. Due: ${dueDate}. Purpose: ${purpose}`
    });
    return newChk;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const docRes = await client.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [documentId]);
    if (docRes.rows.length === 0) throw new Error('Document not found');
    const doc = docRes.rows[0];
    if (doc.status !== 'AVAILABLE') throw new Error(`Document #${doc.document_number} is not available for checkout (status: ${doc.status}).`);
    const activeRes = await client.query(
      'SELECT 1 FROM checkouts WHERE document_id = $1 AND status = ANY($2::text[]) LIMIT 1',
      [documentId, ACTIVE_CHECKOUT_STATUSES]
    );
    if (activeRes.rows.length > 0) throw new Error('An active checkout already exists for this document.');

    const id = 'chk-' + randomUUID();
    await client.query(`
      INSERT INTO checkouts (id, document_id, document_number, document_title, requested_by_user_id, requested_by_user_name, requested_by_department, request_date, due_date, status, purpose, condition_out)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      id, documentId, doc.document_number, doc.title, user.id, user.fullName, user.departmentName,
      requestDate, dueDate, 'REQUESTED', purpose, doc.condition
    ]);

    await client.query('UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2', ['REQUESTED', documentId]);
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'CHECKOUT_REQUESTED', 'DOCUMENT', documentId, doc.document_number, `Checkout requested for document #${doc.document_number}. Due: ${dueDate}. Purpose: ${purpose}`]
    );
    await client.query('COMMIT');

    return {
      id, documentId,
      documentNumber: doc.document_number,
      documentTitle: doc.title,
      requestedByUserId: user.id,
      requestedByUserName: user.fullName,
      requestedByDepartment: user.departmentName,
      requestDate, dueDate, status: 'REQUESTED', purpose,
      conditionOut: doc.condition
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function approveCheckout(checkoutId: string, user: User): Promise<void> {
  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) throw new Error('Checkout not found');
    if (chk.status !== 'REQUESTED') throw new Error(`Checkout is ${chk.status}; only REQUESTED checkouts can be approved.`);
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? { ...c, status: 'APPROVED', approvedByUserId: user.id, approvedByUserName: user.fullName } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? { ...d, status: 'APPROVED' } : d);
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
      action: 'CHECKOUT_APPROVED', entityType: 'CHECKOUT', entityId: checkoutId, entityName: chk.documentNumber,
      timestamp: new Date().toISOString(), details: `Approved checkout of document #${chk.documentNumber} for ${chk.requestedByUserName}.`
    });
    return;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1 FOR UPDATE', [checkoutId]);
    if (chkRes.rows.length === 0) throw new Error('Checkout not found');
    const chk = chkRes.rows[0];
    if (chk.status !== 'REQUESTED') throw new Error(`Checkout is ${chk.status}; only REQUESTED checkouts can be approved.`);

    await client.query(`
      UPDATE checkouts SET status = $1, approved_by_user_id = $2, approved_by_user_name = $3 WHERE id = $4
    `, ['APPROVED', user.id, user.fullName, checkoutId]);

    await client.query('UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2', ['APPROVED', chk.document_id]);
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'CHECKOUT_APPROVED', 'CHECKOUT', checkoutId, chk.document_number, `Approved checkout of document #${chk.document_number} for ${chk.requested_by_user_name}.`]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectCheckout(checkoutId: string, reason: string, user: User): Promise<void> {
  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) throw new Error('Checkout not found');
    if (chk.status !== 'REQUESTED' && chk.status !== 'APPROVED') throw new Error(`Checkout is ${chk.status}; only REQUESTED or APPROVED checkouts can be rejected.`);
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? { ...c, status: 'REJECTED', notes: reason } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? { ...d, status: 'AVAILABLE' } : d);
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
      action: 'CHECKOUT_REJECTED', entityType: 'CHECKOUT', entityId: checkoutId, entityName: chk.documentNumber,
      timestamp: new Date().toISOString(), details: `Rejected checkout of document #${chk.documentNumber}. Reason: ${reason}`
    });
    return;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1 FOR UPDATE', [checkoutId]);
    if (chkRes.rows.length === 0) throw new Error('Checkout not found');
    const chk = chkRes.rows[0];
    if (chk.status !== 'REQUESTED' && chk.status !== 'APPROVED') throw new Error(`Checkout is ${chk.status}; only REQUESTED or APPROVED checkouts can be rejected.`);

    await client.query('UPDATE checkouts SET status = $1, notes = $2 WHERE id = $3', ['REJECTED', reason, checkoutId]);
    await client.query('UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2', ['AVAILABLE', chk.document_id]);
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'CHECKOUT_REJECTED', 'CHECKOUT', checkoutId, chk.document_number, `Rejected checkout of document #${chk.document_number}. Reason: ${reason}`]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function processCheckoutDispatch(
  checkoutId: string, 
  tempLocationId: string, 
  user: User, 
  fromPath: string, 
  toPath: string
): Promise<void> {
  const checkoutDate = new Date().toISOString().split('T')[0];

  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) throw new Error('Checkout not found');
    if (chk.status !== 'APPROVED') throw new Error(`Checkout is ${chk.status}; only APPROVED checkouts can be dispatched.`);
    const doc = memoryDocuments.find(d => d.id === chk.documentId);
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? {
      ...c, status: 'CHECKED_OUT', checkoutDate, checkedOutByUserId: user.id, checkedOutByUserName: user.fullName
    } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? {
      ...d, currentLocationId: tempLocationId, status: 'CHECKED_OUT', custodianName: `${chk.requestedByDepartment} (${chk.requestedByUserName})`
    } : d);
    memoryMovements.unshift({
      id: 'mvt-' + randomUUID(),
      documentId: chk.documentId,
      documentNumber: chk.documentNumber,
      documentTitle: chk.documentTitle,
      fromLocationId: doc?.currentLocationId ?? null,
      fromLocationPath: fromPath,
      toLocationId: tempLocationId,
      toLocationPath: toPath,
      movementType: 'CHECKOUT',
      performedByUserId: user.id,
      performedByUserName: user.fullName,
      reason: `Authorized Physical Checkout for ${chk.requestedByUserName}`,
      timestamp: new Date().toISOString()
    });
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
      action: 'CHECKOUT_DISPATCHED', entityType: 'CHECKOUT', entityId: checkoutId, entityName: chk.documentNumber,
      timestamp: new Date().toISOString(), details: `Document #${chk.documentNumber} physically checked out to ${chk.requestedByUserName}.`
    });
    refreshMemoryOccupancy();
    return;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1 FOR UPDATE', [checkoutId]);
    if (chkRes.rows.length === 0) throw new Error('Checkout not found');
    const chk = chkRes.rows[0];
    if (chk.status !== 'APPROVED') throw new Error(`Checkout is ${chk.status}; only APPROVED checkouts can be dispatched.`);

    const docRes = await client.query('SELECT current_location_id FROM documents WHERE id = $1 FOR UPDATE', [chk.document_id]);
    if (docRes.rows.length === 0) throw new Error('Document not found');
    const previousLocationId = docRes.rows[0].current_location_id;

    await client.query(`
      UPDATE checkouts 
      SET status = $1, checkout_date = $2, checked_out_by_user_id = $3, checked_out_by_user_name = $4 
      WHERE id = $5
    `, ['CHECKED_OUT', checkoutDate, user.id, user.fullName, checkoutId]);

    await client.query(`
      UPDATE documents 
      SET current_location_id = $1, status = $2, custodian_name = $3, updated_at = NOW() 
      WHERE id = $4
    `, [tempLocationId, 'CHECKED_OUT', `${chk.requested_by_department} (${chk.requested_by_user_name})`, chk.document_id]);

    await client.query(`
      INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      'mvt-' + randomUUID(), chk.document_id, chk.document_number, chk.document_title,
      previousLocationId, fromPath, tempLocationId, toPath, 'CHECKOUT',
      user.id, user.fullName, `Authorized Physical Checkout for ${chk.requested_by_user_name}`
    ]);

    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'CHECKOUT_DISPATCHED', 'CHECKOUT', checkoutId, chk.document_number, `Document #${chk.document_number} physically checked out to ${chk.requested_by_user_name}.`]
    );

    await refreshOccupancy(client, [previousLocationId, tempLocationId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
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
  const returnDate = new Date().toISOString().split('T')[0];

  if (!isDbAvailable()) {
    const chk = memoryCheckouts.find(c => c.id === checkoutId);
    if (!chk) throw new Error('Checkout record not found');
    if (chk.status !== 'CHECKED_OUT' && chk.status !== 'OVERDUE') throw new Error(`Checkout is ${chk.status}; only CHECKED_OUT or OVERDUE checkouts can be returned.`);
    const doc = memoryDocuments.find(d => d.id === chk.documentId);
    memoryCheckouts = memoryCheckouts.map(c => c.id === checkoutId ? {
      ...c, status: 'RETURNED', returnDate, conditionIn, returnedByUserName: user.fullName, notes: notes || c.notes
    } : c);
    memoryDocuments = memoryDocuments.map(d => d.id === chk.documentId ? {
      ...d, currentLocationId: returnLocationId, status: 'AVAILABLE', condition: conditionIn, custodianName: 'Records Office'
    } : d);
    memoryMovements.unshift({
      id: 'mvt-' + randomUUID(),
      documentId: chk.documentId,
      documentNumber: chk.documentNumber,
      documentTitle: chk.documentTitle,
      fromLocationId: doc?.currentLocationId ?? null,
      fromLocationPath: fromPath,
      toLocationId: returnLocationId,
      toLocationPath: toPath,
      movementType: 'CHECKIN',
      performedByUserId: user.id,
      performedByUserName: user.fullName,
      reason: `Check-In Return to Archive Storage. Condition: ${conditionIn}`,
      timestamp: new Date().toISOString()
    });
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
      action: 'CHECKOUT_RETURNED', entityType: 'CHECKOUT', entityId: checkoutId, entityName: chk.documentNumber,
      timestamp: new Date().toISOString(), details: `Document #${chk.documentNumber} returned to storage. Condition: ${conditionIn}.`
    });
    refreshMemoryOccupancy();
    return;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const chkRes = await client.query('SELECT * FROM checkouts WHERE id = $1 FOR UPDATE', [checkoutId]);
    if (chkRes.rows.length === 0) throw new Error('Checkout record not found');
    const chk = chkRes.rows[0];
    if (chk.status !== 'CHECKED_OUT' && chk.status !== 'OVERDUE') throw new Error(`Checkout is ${chk.status}; only CHECKED_OUT or OVERDUE checkouts can be returned.`);

    const docRes = await client.query('SELECT current_location_id FROM documents WHERE id = $1 FOR UPDATE', [chk.document_id]);
    if (docRes.rows.length === 0) throw new Error('Document not found');
    const previousLocationId = docRes.rows[0].current_location_id;

    await client.query(`
      UPDATE checkouts 
      SET status = $1, return_date = $2, condition_in = $3, returned_by_user_name = $4, notes = $5 
      WHERE id = $6
    `, ['RETURNED', returnDate, conditionIn, user.fullName, notes || chk.notes || null, checkoutId]);

    await client.query(`
      UPDATE documents 
      SET current_location_id = $1, status = $2, condition = $3, custodian_name = $4, updated_at = NOW() 
      WHERE id = $5
    `, [returnLocationId, 'AVAILABLE', conditionIn, 'Records Office', chk.document_id]);

    await client.query(`
      INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      'mvt-' + randomUUID(), chk.document_id, chk.document_number, chk.document_title,
      previousLocationId, fromPath, returnLocationId, toPath, 'CHECKIN',
      user.id, user.fullName, `Check-In Return to Archive Storage. Condition: ${conditionIn}`
    ]);

    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'CHECKOUT_RETURNED', 'CHECKOUT', checkoutId, chk.document_number, `Document #${chk.document_number} returned to storage. Condition: ${conditionIn}.`]
    );

    await refreshOccupancy(client, [previousLocationId, returnLocationId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// --- MOVEMENTS REPOSITORY ---
export async function getMovements(): Promise<MovementRecord[]> {
  if (!isDbAvailable()) return memoryMovements;
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
}

// --- RETENTION POLICIES REPOSITORY ---
export async function getRetentionPolicies(): Promise<RetentionPolicy[]> {
  if (!isDbAvailable()) return memoryRetentionPolicies;
  const res = await pgPool!.query('SELECT * FROM retention_policies ORDER BY document_type_name ASC');
  return res.rows.map(r => ({
    id: r.id,
    documentTypeId: r.document_type_id,
    documentTypeName: r.document_type_name,
    retentionYears: r.retention_years,
    disposalMethod: r.disposal_method,
    description: r.description
  }));
}

// --- AUDIT LOGS REPOSITORY ---
export async function getAuditLogs(): Promise<AuditLogRecord[]> {
  if (!isDbAvailable()) return memoryAuditLogs;
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
}

export async function createAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<AuditLogRecord> {
  const id = 'aud-' + randomUUID();
  const timestamp = new Date().toISOString();
  const newLog: AuditLogRecord = { ...log, id, timestamp };

  if (!isDbAvailable()) {
    memoryAuditLogs.unshift(newLog);
    return newLog;
  }

  await pgPool!.query(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, before_value, after_value)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [id, log.userId, log.userName, log.userRole, log.action, log.entityType, log.entityId, log.entityName, log.details, log.beforeValue || null, log.afterValue || null]);

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
}

export async function createReusableCustomField(data: Omit<ReusableCustomField, 'id' | 'createdAt'>): Promise<ReusableCustomField> {
  const id = 'rcf-' + randomUUID();
  const newField: ReusableCustomField = {
    ...data,
    id,
    createdAt: new Date().toISOString()
  };

  if (!isDbAvailable()) {
    memoryReusableCustomFields.push(newField);
    return newField;
  }

  await pgPool!.query(`
    INSERT INTO reusable_custom_fields (id, name, label, type, options, placeholder, required, description, category)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    newField.id, newField.name, newField.label, newField.type,
    JSON.stringify(newField.options || []), newField.placeholder || null,
    newField.required || false, newField.description || null, newField.category || 'General'
  ]);

  return newField;
}

export async function updateReusableCustomField(id: string, updates: Partial<ReusableCustomField>): Promise<void> {
  if (!isDbAvailable()) {
    memoryReusableCustomFields = memoryReusableCustomFields.map(f => f.id === id ? { ...f, ...updates } : f);
    return;
  }

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
}

export async function deleteReusableCustomField(id: string): Promise<void> {
  if (!isDbAvailable()) {
    memoryReusableCustomFields = memoryReusableCustomFields.filter(f => f.id !== id);
    return;
  }
  await pgPool!.query('DELETE FROM reusable_custom_fields WHERE id = $1', [id]);
}

// --- BUNDLES REPOSITORY ---
export async function getBundles(): Promise<DocumentBundle[]> {
  if (!isDbAvailable()) return memoryBundles;
  const res = await pgPool!.query('SELECT * FROM bundles ORDER BY created_at DESC');
  return res.rows.map(mapBundleRow);
}

/** Attach documents to a bundle, detaching them from any other bundle first. */
async function assignBundleDocuments(client: PoolClient, bundleId: string, bundleNumber: string, title: string, docIds: string[]): Promise<void> {
  if (docIds.length === 0) return;
  await client.query(`
    UPDATE bundles
    SET document_ids = COALESCE((
      SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(document_ids) elem
      WHERE NOT (elem = ANY($2::text[]))
    ), '[]'::jsonb), updated_at = NOW()
    WHERE id <> $1 AND document_ids ?| $2::text[]
  `, [bundleId, docIds]);
  await client.query(`
    UPDATE documents SET bundle_id = $1, bundle_number = $2, bundle_title = $3, updated_at = NOW()
    WHERE id = ANY($4::text[])
  `, [bundleId, bundleNumber, title, docIds]);
}

function assignMemoryBundleDocuments(bundleId: string, bundleNumber: string, title: string, docIds: string[]): void {
  const now = new Date().toISOString();
  memoryBundles = memoryBundles.map(b => b.id === bundleId ? b : { ...b, documentIds: b.documentIds.filter(id => !docIds.includes(id)) });
  memoryDocuments = memoryDocuments.map(d => docIds.includes(d.id)
    ? { ...d, bundleId, bundleNumber, bundleTitle: title, updatedAt: now }
    : d);
}

export async function createBundle(data: Omit<DocumentBundle, 'id' | 'createdAt' | 'updatedAt' | 'qrCode' | 'barcode'>, user?: User): Promise<DocumentBundle> {
  const id = 'bndl-' + randomUUID();
  const qrCode = 'BNDL-' + data.bundleNumber;
  const barcode = await generateUniqueBarcode('bundles', '889', 6);
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
    assignMemoryBundleDocuments(newBundle.id, newBundle.bundleNumber, newBundle.title, newBundle.documentIds || []);
    if (user) {
      memoryAuditLogs.unshift({
        id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
        action: 'BUNDLE_CREATED', entityType: 'BUNDLE', entityId: newBundle.id, entityName: newBundle.title,
        timestamp: now, details: `Created bundle dossier ${newBundle.bundleNumber} containing ${(newBundle.documentIds || []).length} document(s)`
      });
    }
    return newBundle;
  }

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

    await assignBundleDocuments(client, newBundle.id, newBundle.bundleNumber, newBundle.title, newBundle.documentIds || []);

    if (user) {
      await client.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'aud-' + randomUUID(), user.id, user.fullName, user.role, 'BUNDLE_CREATED',
        'BUNDLE', newBundle.id, newBundle.title, `Created bundle dossier ${newBundle.bundleNumber} containing ${(newBundle.documentIds || []).length} document(s)`
      ]);
    }

    await client.query('COMMIT');
    return newBundle;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function updateBundle(id: string, updates: Partial<DocumentBundle>, user?: User): Promise<void> {
  const now = new Date().toISOString();
  if (!isDbAvailable()) {
    const existing = memoryBundles.find(b => b.id === id);
    if (!existing) throw new Error('Bundle not found');
    const merged: DocumentBundle = { ...existing, ...updates, updatedAt: now };
    memoryBundles = memoryBundles.map(b => b.id === id ? merged : b);
    if (updates.documentIds !== undefined) {
      const newIds = Array.from(new Set(updates.documentIds));
      // Clear membership for documents removed from this bundle
      memoryDocuments = memoryDocuments.map(d =>
        d.bundleId === id && !newIds.includes(d.id)
          ? { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined, updatedAt: now }
          : d
      );
      assignMemoryBundleDocuments(id, merged.bundleNumber, merged.title, newIds);
    }
    // Keep denormalized bundle labels on member documents in sync
    memoryDocuments = memoryDocuments.map(d => d.bundleId === id
      ? { ...d, bundleNumber: merged.bundleNumber, bundleTitle: merged.title, updatedAt: now }
      : d);
    if (user) {
      memoryAuditLogs.unshift({
        id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
        action: 'BUNDLE_UPDATED', entityType: 'BUNDLE', entityId: id, entityName: merged.title,
        timestamp: now, details: `Updated bundle dossier ${merged.bundleNumber}.`
      });
    }
    return;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const bundleRes = await client.query('SELECT * FROM bundles WHERE id = $1 FOR UPDATE', [id]);
    if (bundleRes.rows.length === 0) throw new Error('Bundle not found');
    const oldDocIds = toStringArray(bundleRes.rows[0].document_ids);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.bundleNumber !== undefined) { fields.push(`bundle_number = $${idx++}`); values.push(updates.bundleNumber); }
    if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.imageUrl !== undefined) { fields.push(`image_url = $${idx++}`); values.push(updates.imageUrl); }
    if (updates.departmentId !== undefined) { fields.push(`department_id = $${idx++}`); values.push(updates.departmentId); }
    if (updates.departmentName !== undefined) { fields.push(`department_name = $${idx++}`); values.push(updates.departmentName); }
    if (updates.locationId !== undefined) { fields.push(`location_id = $${idx++}`); values.push(updates.locationId); }
    if (updates.locationPath !== undefined) { fields.push(`location_path = $${idx++}`); values.push(updates.locationPath); }
    if (updates.documentIds !== undefined) { fields.push(`document_ids = $${idx++}`); values.push(JSON.stringify(Array.from(new Set(updates.documentIds)))); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(JSON.stringify(updates.tags)); }

    fields.push(`updated_at = NOW()`);
    values.push(id);
    await client.query(`UPDATE bundles SET ${fields.join(', ')} WHERE id = $${idx}`, values);

    const bundleNumber = updates.bundleNumber !== undefined ? updates.bundleNumber : bundleRes.rows[0].bundle_number;
    const title = updates.title !== undefined ? updates.title : bundleRes.rows[0].title;

    if (updates.documentIds !== undefined) {
      const newIds = Array.from(new Set(updates.documentIds));
      const removed = oldDocIds.filter(docId => !newIds.includes(docId));
      if (removed.length > 0) {
        await client.query(`
          UPDATE documents SET bundle_id = NULL, bundle_number = NULL, bundle_title = NULL, updated_at = NOW()
          WHERE bundle_id = $1 AND id = ANY($2::text[])
        `, [id, removed]);
      }
      await assignBundleDocuments(client, id, bundleNumber, title, newIds);
    }

    // Propagate renamed bundle labels to all member documents
    await client.query(`
      UPDATE documents SET bundle_number = $1, bundle_title = $2, updated_at = NOW() WHERE bundle_id = $3
    `, [bundleNumber, title, id]);

    if (user) {
      await client.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'aud-' + randomUUID(), user.id, user.fullName, user.role, 'BUNDLE_UPDATED',
        'BUNDLE', id, title, `Updated bundle dossier ${bundleNumber}.`
      ]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteBundle(id: string, user?: User): Promise<void> {
  if (!isDbAvailable()) {
    memoryBundles = memoryBundles.filter(b => b.id !== id);
    memoryDocuments = memoryDocuments.map(d => d.bundleId === id ? { ...d, bundleId: undefined, bundleNumber: undefined, bundleTitle: undefined } : d);
    if (user) {
      memoryAuditLogs.unshift({
        id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
        action: 'BUNDLE_DELETED', entityType: 'BUNDLE', entityId: id, entityName: `Bundle #${id}`,
        timestamp: new Date().toISOString(), details: `Deleted bundle dossier #${id} and unlinked documents.`
      });
    }
    return;
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE documents SET bundle_id = NULL, bundle_number = NULL, bundle_title = NULL, updated_at = NOW() WHERE bundle_id = $1', [id]);
    await client.query('DELETE FROM bundles WHERE id = $1', [id]);
    if (user) {
      await client.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'aud-' + randomUUID(), user.id, user.fullName, user.role, 'BUNDLE_DELETED',
        'BUNDLE', id, `Bundle #${id}`, `Deleted bundle dossier #${id} and unlinked documents.`
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function addDocumentsToBundle(bundleId: string, docIds: string[], user?: User): Promise<void> {
  const bundles = await getBundles();
  const targetBundle = bundles.find(b => b.id === bundleId);
  if (!targetBundle) throw new Error('Bundle not found');

  const newDocIds = Array.from(new Set([...targetBundle.documentIds, ...docIds]));
  // updateBundle keeps both sides (bundle list + document rows) in sync atomically
  await updateBundle(bundleId, { documentIds: newDocIds }, user);
}

export async function removeDocumentFromBundle(bundleId: string, docId: string, user?: User): Promise<void> {
  const bundles = await getBundles();
  const targetBundle = bundles.find(b => b.id === bundleId);
  if (!targetBundle) throw new Error('Bundle not found');

  const newDocIds = targetBundle.documentIds.filter(id => id !== docId);
  await updateBundle(bundleId, { documentIds: newDocIds }, user);
}

// --- SET-BASED BULK OPERATIONS ---
// Each bulk operation runs as ONE transaction with set-based SQL, so hundreds
// of records are handled in a handful of statements instead of N round-trips.

export async function bulkUpdateDocuments(documentIds: string[], updates: Partial<DocumentItem>, user: User): Promise<{ updated: number }> {
  const ids = Array.from(new Set(documentIds));
  if (ids.length === 0) return { updated: 0 };
  const now = new Date().toISOString();

  if (!isDbAvailable()) {
    let updated = 0;
    memoryDocuments = memoryDocuments.map(d => {
      if (!ids.includes(d.id)) return d;
      updated++;
      return { ...d, ...updates, updatedAt: now };
    });
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
      action: 'BULK_UPDATE', entityType: 'DOCUMENT', entityId: 'bulk', entityName: 'Bulk update',
      timestamp: now, details: `Bulk-updated ${updated} document(s). Fields: ${Object.keys(updates).join(', ')}.`
    });
    return { updated };
  }

  const { fields, values, nextIdx } = documentUpdateAssignments(updates, 1);
  if (fields.length === 0) return { updated: 0 };

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    fields.push('updated_at = NOW()');
    values.push(ids);
    const res = await client.query(
      `UPDATE documents SET ${fields.join(', ')} WHERE id = ANY($${nextIdx}::text[])`,
      values
    );
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'BULK_UPDATE', 'DOCUMENT', 'bulk', 'Bulk update', `Bulk-updated ${res.rowCount ?? 0} document(s). Fields: ${Object.keys(updates).join(', ')}.`]
    );
    await client.query('COMMIT');
    return { updated: res.rowCount ?? 0 };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function batchMoveDocuments(
  documentIds: string[],
  toLocationId: string,
  reason: string,
  user: User,
  fromPaths: Record<string, string>,
  toPath: string
): Promise<{ moved: number }> {
  const ids = Array.from(new Set(documentIds));
  if (ids.length === 0) return { moved: 0 };
  const now = new Date().toISOString();
  const moveReason = reason || 'Batch Relocation Transfer';

  if (!isDbAvailable()) {
    let moved = 0;
    for (const docId of ids) {
      const doc = memoryDocuments.find(d => d.id === docId);
      if (!doc) continue;
      const previousLocationId = doc.currentLocationId;
      memoryDocuments = memoryDocuments.map(d => d.id === docId ? { ...d, currentLocationId: toLocationId, updatedAt: now } : d);
      memoryMovements.unshift({
        id: 'mvt-' + randomUUID(),
        documentId: docId,
        documentNumber: doc.documentNumber,
        documentTitle: doc.title,
        fromLocationId: previousLocationId,
        fromLocationPath: fromPaths[docId] || 'Unknown',
        toLocationId,
        toLocationPath: toPath,
        movementType: 'RELOCATION',
        performedByUserId: user.id,
        performedByUserName: user.fullName,
        reason: moveReason,
        timestamp: now
      });
      moved++;
    }
    memoryAuditLogs.unshift({
      id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
      action: 'BULK_RELOCATION', entityType: 'DOCUMENT', entityId: 'bulk', entityName: 'Batch relocation',
      timestamp: now, details: `Batch-relocated ${moved} document(s) to [${toPath}]. Reason: ${moveReason}`
    });
    refreshMemoryOccupancy();
    return { moved };
  }

  const client = await pgPool!.connect();
  try {
    await client.query('BEGIN');
    const prevRes = await client.query(
      'SELECT id, current_location_id FROM documents WHERE id = ANY($1::text[]) FOR UPDATE',
      [ids]
    );
    if (prevRes.rows.length === 0) throw new Error('No matching documents found');
    const foundIds = prevRes.rows.map(r => r.id);

    // Record the movement trail BEFORE the location update so the SELECT still
    // sees each document's previous location.
    await client.query(`
      INSERT INTO movements (id, document_id, document_number, document_title, from_location_id, from_location_path, to_location_id, to_location_path, movement_type, performed_by_user_id, performed_by_user_name, reason)
      SELECT 'mvt-' || gen_random_uuid(), d.id, d.document_number, d.title, d.current_location_id,
             COALESCE($2::jsonb ->> d.id, 'Unknown'), $3, $4, 'RELOCATION', $5, $6, $7
      FROM documents d WHERE d.id = ANY($1::text[])
    `, [ids, JSON.stringify(fromPaths || {}), toLocationId, toPath, user.id, user.fullName, moveReason]);

    await client.query(
      'UPDATE documents SET current_location_id = $1, updated_at = NOW() WHERE id = ANY($2::text[])',
      [toLocationId, foundIds]
    );

    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['aud-' + randomUUID(), user.id, user.fullName, user.role, 'BULK_RELOCATION', 'DOCUMENT', 'bulk', 'Batch relocation', `Batch-relocated ${foundIds.length} document(s) to [${toPath}]. Reason: ${moveReason}`]
    );

    await refreshOccupancy(client, [...prevRes.rows.map(r => r.current_location_id), toLocationId]);
    await client.query('COMMIT');
    return { moved: foundIds.length };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function bulkDeleteDocuments(documentIds: string[], user: User): Promise<{ deleted: number; skipped: { id: string; reason: string }[] }> {
  const ids = Array.from(new Set(documentIds));
  const skipped: { id: string; reason: string }[] = [];
  if (ids.length === 0) return { deleted: 0, skipped };
  const now = new Date().toISOString();
  const disposalDate = now.slice(0, 10);

  if (!isDbAvailable()) {
    let deleted = 0;
    for (const docId of ids) {
      const doc = memoryDocuments.find(d => d.id === docId);
      if (!doc) { skipped.push({ id: docId, reason: 'record not found' }); continue; }
      if (doc.status === 'CHECKED_OUT') { skipped.push({ id: docId, reason: `#${doc.documentNumber} is currently checked out` }); continue; }
      const certificateNumber = 'DEL-' + randomUUID().slice(0, 8).toUpperCase();
      memoryDisposalRecords.unshift({
        id: 'disp-' + randomUUID(), documentId: docId, documentNumber: doc.documentNumber, documentTitle: doc.title,
        requestedByUserName: user.fullName, approvedByUserName: user.fullName, disposalDate,
        disposalMethod: 'ADMIN_DELETION', certificateNumber, witnessName: user.fullName,
        notes: 'Record removed from the archive registry (bulk deletion).'
      });
      memoryAuditLogs.unshift({
        id: 'aud-' + randomUUID(), userId: user.id, userName: user.fullName, userRole: user.role,
        action: 'DOCUMENT_DELETED', entityType: 'DOCUMENT', entityId: docId, entityName: doc.documentNumber,
        timestamp: now, details: `Deleted document #${doc.documentNumber} (${doc.title}) via bulk deletion. Disposal certificate ${certificateNumber}.`
      });
      memoryDocuments = memoryDocuments.filter(d => d.id !== docId);
      deleteDocumentFiles(docId);
      deleted++;
    }
    refreshMemoryOccupancy();
    return { deleted, skipped };
  }

  const client = await pgPool!.connect();
  let deletedIds: string[] = [];
  try {
    await client.query('BEGIN');
    const res = await client.query(
      'SELECT id, document_number, status, current_location_id, home_location_id FROM documents WHERE id = ANY($1::text[]) FOR UPDATE',
      [ids]
    );
    const found = new Map(res.rows.map(r => [r.id, r]));
    for (const docId of ids) {
      const row = found.get(docId);
      if (!row) { skipped.push({ id: docId, reason: 'record not found' }); continue; }
      if (row.status === 'CHECKED_OUT') { skipped.push({ id: docId, reason: `#${row.document_number} is currently checked out` }); continue; }
      deletedIds.push(docId);
    }

    if (deletedIds.length > 0) {
      await client.query(`
        INSERT INTO disposal_records (id, document_id, document_number, document_title, requested_by_user_name, approved_by_user_name, disposal_date, disposal_method, certificate_number, witness_name, notes)
        SELECT 'disp-' || gen_random_uuid(), d.id, d.document_number, d.title, $2, $2, $3, 'ADMIN_DELETION',
               'DEL-' || upper(substr(gen_random_uuid()::text, 1, 8)), $2, 'Record removed from the archive registry (bulk deletion).'
        FROM documents d WHERE d.id = ANY($4::text[])
      `, [ids, user.fullName, disposalDate, deletedIds]);

      await client.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
        SELECT 'aud-' || gen_random_uuid(), $2, $3, $4, 'DOCUMENT_DELETED', 'DOCUMENT', d.id, d.document_number,
               'Deleted document #' || d.document_number || ' (' || d.title || ') via bulk deletion.'
        FROM documents d WHERE d.id = ANY($1::text[])
      `, [deletedIds, user.id, user.fullName, user.role]);

      await client.query('DELETE FROM documents WHERE id = ANY($1::text[])', [deletedIds]);
      const affectedLocations = res.rows
        .filter(r => deletedIds.includes(r.id))
        .flatMap(r => [r.current_location_id, r.home_location_id]);
      await refreshOccupancy(client, affectedLocations);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  for (const docId of deletedIds) deleteDocumentFiles(docId);
  return { deleted: deletedIds.length, skipped };
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

// --- CSV Export Helpers ---

/**
 * Escape a field for CSV: wrap in quotes if it contains comma, quote, or newline.
 * Values that would be interpreted as spreadsheet formulas are prefixed with a
 * single quote to neutralize CSV injection (=, +, -, @, tab/CR leaders).
 */
function csvEscape(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV header row from an array of objects (using common keys).
 */
function generateCsvHeader(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  return [...keys].map(csvEscape).join(',') + '\n';
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

// ========== CSV Export Utils ==========

/** Build a CSV string from an array of objects (all entities). */
export function generateCsvFromEntities(rows: any[]): string {
  if (rows.length === 0) return '';
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  const header = [...keys].map(csvEscape).join(',') + '\n';
  let body = '';
  for (const row of rows) {
    const vals = [...keys].map(k => csvEscape(row[k]));
    body += vals.join(',') + '\n';
  }
  return header + body;
}

export function generateCsvFromDocuments(docs: DocumentItem[]): string {
  return generateCsvFromEntities(docs);
}

export function generateCsvFromLocations(locations: LocationItem[]): string {
  return generateCsvFromEntities(locations);
}

export function generateCsvFromUsers(users: User[]): string {
  // Never leak password hashes through CSV exports
  return generateCsvFromEntities(users.map(({ password, ...rest }) => rest));
}

export function generateCsvFromDocumentTypes(docTypes: DocumentTypeInfo[]): string {
  return generateCsvFromEntities(docTypes);
}

export function generateCsvFromCheckouts(checkouts: CheckoutRecord[]): string {
  return generateCsvFromEntities(checkouts);
}

export function generateCsvFromMovements(movements: MovementRecord[]): string {
  return generateCsvFromEntities(movements);
}

export function generateCsvFromRetentionPolicies(policies: RetentionPolicy[]): string {
  return generateCsvFromEntities(policies);
}

export function generateCsvFromBundles(bundles: DocumentBundle[]): string {
  return generateCsvFromEntities(bundles);
}

export function generateCsvFromDisposals(disposals: DisposalRecord[]): string {
  return generateCsvFromEntities(disposals);
}

export function generateCsvFromAuditLogs(auditLogs: AuditLogRecord[]): string {
  return generateCsvFromEntities(auditLogs);
}
