/**
 * ArchiveHub - Physical & Digital Archive Management System (PDAMS)
 * Core Type Definitions
 */

export type RoleCode = 'ADMIN' | 'RECORDS_ADMIN' | 'RECORDS_OFFICER' | 'DEPT_USER' | 'AUDITOR';

export type ApprovalStatus = 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  role: RoleCode;
  departmentId: string;
  departmentName: string;
  avatarUrl?: string;
  title?: string;
  approvalStatus?: ApprovalStatus;
  createdAt?: string;
}

export type LocationType = 
  | 'BUILDING' 
  | 'FLOOR' 
  | 'ROOM' 
  | 'STORAGE_AREA' 
  | 'CABINET' 
  | 'RACK' 
  | 'SHELF' 
  | 'BOX' 
  | 'FOLDER' 
  | 'OTHER';

export interface LocationItem {
  id: string;
  parentId: string | null;
  type: LocationType;
  code: string; // e.g. BLD-01, RM-01, CAB-03, BOX-017
  name: string; // e.g. Administration Building, Records Room 01, Cabinet C-03
  description?: string;
  imageUrl?: string; // Photo of the physical storage location / unit
  capacity?: number; // capacity in number of child items / boxes / folders
  currentOccupancy?: number;
  qrCode: string;
  barcode: string;
  departmentId?: string | null;
  departmentName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = 
  | 'DRAFT'
  | 'REGISTERED'
  | 'FILED'
  | 'AVAILABLE'
  | 'REQUESTED'
  | 'APPROVED'
  | 'CHECKED_OUT'
  | 'IN_TRANSIT'
  | 'RETURNED'
  | 'MISSING'
  | 'DAMAGED'
  | 'ARCHIVED'
  | 'FOR_DISPOSAL'
  | 'DISPOSED';

export type ConfidentialityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type DocumentCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'MISSING';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomFieldDefinition {
  id: string;
  name: string; // key name e.g. "period", "fundSource", "office"
  label: string; // user-facing label e.g. "Period / Fiscal Cycle", "Fund Source", "Originating Office"
  type: CustomFieldType;
  options?: string[]; // list of choices for select fields
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export interface ReusableCustomField {
  id: string;
  name: string; // unique key identifier e.g. "project_code" or "Project Code"
  label: string; // display label e.g. "Project Code / WBS"
  type: CustomFieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  description?: string;
  category?: string; // e.g. "Financial", "Engineering", "Legal", "Procurement", "General"
  createdAt?: string;
}

export interface DocumentBundle {
  id: string;
  bundleNumber: string; // e.g. BNDL-2026-0001
  title: string; // e.g. "Q1 Infrastructure Procurement Dossier"
  description?: string;
  departmentId: string;
  departmentName: string;
  locationId?: string; // Physical storage location of the bundle container/dossier
  locationPath?: string;
  documentIds: string[]; // List of included document IDs
  status: 'ACTIVE' | 'ARCHIVED' | 'SEALED' | 'CHECKED_OUT';
  qrCode: string;
  barcode: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTypeInfo {
  id: string;
  code: string;
  name: string;
  retentionYears: number;
  description: string;
  departmentId?: string | null; // specific owning department (or null for universal / all departments)
  departmentName?: string | null;
  customFields?: CustomFieldDefinition[];
}

export interface CustomMetadataField {
  key: string;
  label: string;
  value: string;
}

export interface DocumentItem {
  id: string;
  documentNumber: string; // e.g., NIA-2026-001245
  referenceNumber: string;
  title: string;
  documentTypeId: string;
  documentTypeName: string;
  subject?: string;
  description?: string;
  
  departmentId: string;
  departmentName: string;
  custodianName: string;
  
  // PRD MANDATORY RULE 77: Distinct Home vs Current Location
  homeLocationId: string; // Archive origin location (where it normally belongs)
  currentLocationId: string; // Current physical location (could be checked out / in transit / room)
  
  status: DocumentStatus;
  confidentiality: ConfidentialityLevel;
  condition: DocumentCondition;
  
  qrCode: string;
  barcode: string;
  
  documentDate: string; // YYYY-MM-DD
  receivedDate: string;
  filedDate: string;
  retentionStartDate: string;
  retentionEndDate: string; // calculated from retention policy
  disposalDate?: string;
  
  hasDigitalCopy: boolean;
  digitalFileName?: string;
  digitalFileSize?: string;
  digitalFileType?: string;
  digitalFileVersion?: number;
  
  customMetadata?: CustomMetadataField[];
  customFieldValues?: Record<string, string | number>;
  conditionNotes?: string;

  bundleId?: string | null;
  bundleNumber?: string | null;
  bundleTitle?: string | null;
  
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'INITIAL_FILING' | 'CHECKOUT' | 'CHECKIN' | 'RELOCATION' | 'TRANSFER' | 'AUDIT_CORRECTION';

export interface MovementRecord {
  id: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  fromLocationId: string;
  fromLocationPath: string;
  toLocationId: string;
  toLocationPath: string;
  movementType: MovementType;
  performedByUserId: string;
  performedByUserName: string;
  authorizedByUserName?: string;
  reason: string;
  timestamp: string;
  notes?: string;
}

export type CheckoutStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CHECKED_OUT' | 'OVERDUE' | 'RETURNED';

export interface CheckoutRecord {
  id: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  
  requestedByUserId: string;
  requestedByUserName: string;
  requestedByDepartment: string;
  
  approvedByUserId?: string;
  approvedByUserName?: string;
  
  checkedOutByUserId?: string;
  checkedOutByUserName?: string;
  
  returnedByUserName?: string;
  
  requestDate: string;
  checkoutDate?: string;
  dueDate: string;
  returnDate?: string;
  
  status: CheckoutStatus;
  purpose: string;
  conditionOut: DocumentCondition;
  conditionIn?: DocumentCondition;
  notes?: string;
}

export interface RetentionPolicy {
  id: string;
  documentTypeId: string;
  documentTypeName: string;
  retentionYears: number;
  disposalMethod: 'PERMANENT_ARCHIVE' | 'SHREDDING' | 'INCINERATION' | 'DIGITAL_ONLY';
  description: string;
}

export interface DisposalRecord {
  id: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  requestedByUserName: string;
  approvedByUserName: string;
  disposalDate: string;
  disposalMethod: string;
  certificateNumber: string;
  witnessName: string;
  notes: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string; // e.g. "DOCUMENT_CREATED", "LOCATION_MOVED", "CHECKOUT_APPROVED"
  entityType: 'DOCUMENT' | 'LOCATION' | 'CHECKOUT' | 'USER' | 'RETENTION';
  entityId: string;
  entityName: string;
  timestamp: string;
  details: string;
  ipAddress?: string;
  beforeValue?: string;
  afterValue?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  headName: string;
  documentCount?: number;
}
