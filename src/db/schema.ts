import { 
  pgTable, 
  varchar, 
  text, 
  integer, 
  boolean, 
  jsonb, 
  timestamp, 
  primaryKey 
} from 'drizzle-orm/pg-core';

// 1. Departments Table
export const departments = pgTable('departments', {
  id: varchar('id', { length: 50 }).primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  headName: varchar('head_name', { length: 255 }).notNull(),
  documentCount: integer('document_count').default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// 2. Users Table
export const users = pgTable('users', {
  id: varchar('id', { length: 50 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // ADMIN, RECORDS_ADMIN, RECORDS_OFFICER, DEPT_USER, AUDITOR
  departmentId: varchar('department_id', { length: 50 }),
  departmentName: varchar('department_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  title: varchar('title', { length: 255 }),
  approvalStatus: varchar('approval_status', { length: 50 }).default('APPROVED'),
  createdAt: timestamp('created_at').defaultNow()
});

// 3. Document Types Table
export const documentTypes = pgTable('document_types', {
  id: varchar('id', { length: 50 }).primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  retentionYears: integer('retention_years').notNull().default(5),
  description: text('description'),
  customFields: jsonb('custom_fields'), // Array of CustomFieldDefinition
  createdAt: timestamp('created_at').defaultNow()
});

// 4. Locations Table (Hierarchical)
export const locations = pgTable('locations', {
  id: varchar('id', { length: 50 }).primaryKey(),
  parentId: varchar('parent_id', { length: 50 }), // Self reference
  type: varchar('type', { length: 50 }).notNull(), // BUILDING, FLOOR, ROOM, CABINET, RACK, SHELF, BOX, FOLDER, OTHER
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  capacity: integer('capacity').default(20),
  currentOccupancy: integer('current_occupancy').default(0),
  qrCode: varchar('qr_code', { length: 100 }).notNull().unique(),
  barcode: varchar('barcode', { length: 100 }).notNull(),
  departmentId: varchar('department_id', { length: 50 }),
  departmentName: varchar('department_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// 5. Documents Table
export const documents = pgTable('documents', {
  id: varchar('id', { length: 50 }).primaryKey(),
  documentNumber: varchar('document_number', { length: 100 }).notNull().unique(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  title: varchar('title', { length: 500 }).notNull(),
  documentTypeId: varchar('document_type_id', { length: 50 }).notNull(),
  documentTypeName: varchar('document_type_name', { length: 255 }).notNull(),
  subject: text('subject'),
  description: text('description'),
  
  departmentId: varchar('department_id', { length: 50 }).notNull(),
  departmentName: varchar('department_name', { length: 255 }).notNull(),
  custodianName: varchar('custodian_name', { length: 255 }).notNull(),
  
  // Home location vs Current location
  homeLocationId: varchar('home_location_id', { length: 50 }).notNull(),
  currentLocationId: varchar('current_location_id', { length: 50 }).notNull(),
  
  status: varchar('status', { length: 50 }).notNull().default('AVAILABLE'),
  confidentiality: varchar('confidentiality', { length: 50 }).notNull().default('INTERNAL'),
  condition: varchar('condition', { length: 50 }).notNull().default('EXCELLENT'),
  
  qrCode: varchar('qr_code', { length: 100 }).notNull().unique(),
  barcode: varchar('barcode', { length: 100 }).notNull(),
  
  documentDate: varchar('document_date', { length: 50 }).notNull(),
  receivedDate: varchar('received_date', { length: 50 }),
  filedDate: varchar('filed_date', { length: 50 }),
  retentionStartDate: varchar('retention_start_date', { length: 50 }),
  retentionEndDate: varchar('retention_end_date', { length: 50 }),
  disposalDate: varchar('disposal_date', { length: 50 }),
  
  hasDigitalCopy: boolean('has_digital_copy').default(false),
  digitalFileName: varchar('digital_file_name', { length: 255 }),
  digitalFileSize: varchar('digital_file_size', { length: 50 }),
  digitalFileType: varchar('digital_file_type', { length: 50 }),
  digitalFileVersion: integer('digital_file_version').default(1),
  
  customMetadata: jsonb('custom_metadata'),
  customFieldValues: jsonb('custom_field_values'),
  conditionNotes: text('condition_notes'),

  // Optional photos of the physical document (base64 data URLs, compressed client-side)
  photos: jsonb('photos').default([]),

  // QR Code Claim tracking: true once the document's QR code has been scanned
  qrClaimed: boolean('qr_claimed').default(false).notNull(),
  qrClaimedAt: timestamp('qr_claimed_at'),
  qrClaimedBy: varchar('qr_claimed_by', { length: 50 }),

  bundleId: varchar('bundle_id', { length: 50 }),
  bundleNumber: varchar('bundle_number', { length: 100 }),
  bundleTitle: varchar('bundle_title', { length: 500 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// 6. Checkouts Table
export const checkouts = pgTable('checkouts', {
  id: varchar('id', { length: 50 }).primaryKey(),
  documentId: varchar('document_id', { length: 50 }).notNull(),
  documentNumber: varchar('document_number', { length: 100 }).notNull(),
  documentTitle: varchar('document_title', { length: 500 }).notNull(),
  
  requestedByUserId: varchar('requested_by_user_id', { length: 50 }).notNull(),
  requestedByUserName: varchar('requested_by_user_name', { length: 255 }).notNull(),
  requestedByDepartment: varchar('requested_by_department', { length: 255 }).notNull(),
  
  approvedByUserId: varchar('approved_by_user_id', { length: 50 }),
  approvedByUserName: varchar('approved_by_user_name', { length: 255 }),
  
  checkedOutByUserId: varchar('checked_out_by_user_id', { length: 50 }),
  checkedOutByUserName: varchar('checked_out_by_user_name', { length: 255 }),
  
  returnedByUserName: varchar('returned_by_user_name', { length: 255 }),
  
  requestDate: varchar('request_date', { length: 50 }).notNull(),
  checkoutDate: varchar('checkout_date', { length: 50 }),
  dueDate: varchar('due_date', { length: 50 }).notNull(),
  returnDate: varchar('return_date', { length: 50 }),
  
  status: varchar('status', { length: 50 }).notNull().default('REQUESTED'),
  purpose: text('purpose').notNull(),
  conditionOut: varchar('condition_out', { length: 50 }).notNull().default('EXCELLENT'),
  conditionIn: varchar('condition_in', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow()
});

// 7. Movements Table
export const movements = pgTable('movements', {
  id: varchar('id', { length: 50 }).primaryKey(),
  documentId: varchar('document_id', { length: 50 }).notNull(),
  documentNumber: varchar('document_number', { length: 100 }).notNull(),
  documentTitle: varchar('document_title', { length: 500 }).notNull(),
  fromLocationId: varchar('from_location_id', { length: 50 }),
  fromLocationPath: text('from_location_path').notNull(),
  toLocationId: varchar('to_location_id', { length: 50 }),
  toLocationPath: text('to_location_path').notNull(),
  movementType: varchar('movement_type', { length: 50 }).notNull(),
  performedByUserId: varchar('performed_by_user_id', { length: 50 }),
  performedByUserName: varchar('performed_by_user_name', { length: 255 }).notNull(),
  authorizedByUserName: varchar('authorized_by_user_name', { length: 255 }),
  reason: text('reason').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  notes: text('notes')
});

// 8. Retention Policies Table
export const retentionPolicies = pgTable('retention_policies', {
  id: varchar('id', { length: 50 }).primaryKey(),
  documentTypeId: varchar('document_type_id', { length: 50 }).notNull(),
  documentTypeName: varchar('document_type_name', { length: 255 }).notNull(),
  retentionYears: integer('retention_years').notNull().default(5),
  disposalMethod: varchar('disposal_method', { length: 50 }).notNull(),
  description: text('description')
});

// 9. Disposal Records Table
export const disposalRecords = pgTable('disposal_records', {
  id: varchar('id', { length: 50 }).primaryKey(),
  documentId: varchar('document_id', { length: 50 }),
  documentNumber: varchar('document_number', { length: 100 }).notNull(),
  documentTitle: varchar('document_title', { length: 500 }).notNull(),
  requestedByUserName: varchar('requested_by_user_name', { length: 255 }).notNull(),
  approvedByUserName: varchar('approved_by_user_name', { length: 255 }).notNull(),
  disposalDate: varchar('disposal_date', { length: 50 }).notNull(),
  disposalMethod: varchar('disposal_method', { length: 50 }).notNull(),
  certificateNumber: varchar('certificate_number', { length: 100 }).notNull(),
  witnessName: varchar('witness_name', { length: 255 }).notNull(),
  notes: text('notes')
});

// 10. Bundles & Dossiers Table
export const bundles = pgTable('bundles', {
  id: varchar('id', { length: 50 }).primaryKey(),
  bundleNumber: varchar('bundle_number', { length: 100 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  departmentId: varchar('department_id', { length: 50 }).notNull(),
  departmentName: varchar('department_name', { length: 255 }).notNull(),
  locationId: varchar('location_id', { length: 50 }),
  locationPath: text('location_path'),
  documentIds: jsonb('document_ids').default([]),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  qrCode: varchar('qr_code', { length: 100 }).notNull().unique(),
  barcode: varchar('barcode', { length: 100 }).notNull(),
  tags: jsonb('tags').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// 11. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  userId: varchar('user_id', { length: 50 }),
  userName: varchar('user_name', { length: 255 }).notNull(),
  userRole: varchar('user_role', { length: 50 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 50 }).notNull(),
  entityName: varchar('entity_name', { length: 255 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  details: text('details').notNull(),
  beforeValue: text('before_value'),
  afterValue: text('after_value')
});
