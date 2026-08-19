# Data Relationships

<cite>
**Referenced Files in This Document**
- [schema.ts](file://src/db/schema.ts)
- [repository.ts](file://src/db/repository.ts)
- [types.ts](file://src/types.ts)
- [index.ts](file://src/db/index.ts)
</cite>

## Table of Contents
1. Introduction
2. Project Structure
3. Core Components
4. Architecture Overview
5. Detailed Component Analysis
6. Dependency Analysis
7. Performance Considerations
8. Troubleshooting Guide
9. Conclusion

## Introduction
This document explains the data relationships in ArchiveHub’s database entities and how the repository layer manages them. It covers:
- User–department associations
- Document-type mappings
- Location hierarchies
- Checkout workflows linking documents to users
- Movement tracking for physical location changes
- Referential integrity constraints, cascade behaviors, and consistency mechanisms
- How queries across multiple tables are abstracted by the repository

## Project Structure
ArchiveHub defines its relational model in a schema module and implements data access with a repository that provides both PostgreSQL-backed operations and an in-memory fallback when the database is unavailable. Types define the domain models used throughout the application.

```mermaid
graph TB
subgraph "Schema"
S_DEPT["departments"]
S_USR["users"]
S_DTYPE["document_types"]
S_LOC["locations"]
S_DOC["documents"]
S_CHK["checkouts"]
S_MOV["movements"]
S_RET["retention_policies"]
S_DIS["disposal_records"]
S_BND["bundles"]
S_AUD["audit_logs"]
end
subgraph "Repository"
R_REPO["repository.ts"]
R_IDX["db/index.ts (pool)"]
end
subgraph "Types"
T_TYPES["types.ts"]
end
R_REPO --> R_IDX
R_REPO --> T_TYPES
R_REPO --> S_DEPT
R_REPO --> S_USR
R_REPO --> S_DTYPE
R_REPO --> S_LOC
R_REPO --> S_DOC
R_REPO --> S_CHK
R_REPO --> S_MOV
R_REPO --> S_RET
R_REPO --> S_DIS
R_REPO --> S_BND
R_REPO --> S_AUD
```

**Diagram sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [repository.ts:1-1597](file://src/db/repository.ts#L1-L1597)
- [index.ts:1-136](file://src/db/index.ts#L1-L136)
- [types.ts:10-283](file://src/types.ts#L10-L283)

**Section sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [repository.ts:1-1597](file://src/db/repository.ts#L1-L1597)
- [types.ts:10-283](file://src/types.ts#L10-L283)
- [index.ts:1-136](file://src/db/index.ts#L1-L136)

## Core Components
The system centers on these entities and their relationships:
- Departments and Users: Many-to-one from users to departments via department_id; denormalized department_name stored on users for display.
- Document Types and Documents: One-to-many from document_types to documents via document_type_id; denormalized document_type_name stored on documents.
- Locations (Hierarchical): Self-referencing parent_id enables tree structures (building/floor/room/cabinet/rack/shelf/box/folder).
- Documents and Locations: Many-to-one via home_location_id and current_location_id; current reflects transient state (e.g., checked out), home reflects permanent archive placement.
- Checkouts: Link documents to requesting/approving/checking-out users; update document status through workflow states.
- Movements: Immutable audit trail of document location changes and checkout events.
- Bundles: Group documents into dossiers; many-to-one from documents to bundles via bundle_id.
- Retention Policies and Disposal Records: Govern lifecycle and disposal of documents based on type.
- Audit Logs: Record user actions across all entities.

Key design notes:
- Denormalization: Several foreign key columns store human-readable names alongside IDs (e.g., department_name, document_type_name, performed_by_user_name) to simplify reads and reporting.
- Status-driven consistency: Document status transitions are enforced within repository transactions during checkouts and returns.
- Transactions: Critical multi-step operations use explicit BEGIN/COMMIT/ROLLBACK to maintain consistency between related tables.

**Section sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [repository.ts:521-633](file://src/db/repository.ts#L521-L633)
- [repository.ts:840-1122](file://src/db/repository.ts#L840-L1122)
- [repository.ts:1374-1456](file://src/db/repository.ts#L1374-L1456)

## Architecture Overview
The repository layer abstracts database interactions behind typed functions. It uses a PostgreSQL pool when available and falls back to in-memory arrays otherwise, ensuring resilience during development or connectivity issues.

```mermaid
sequenceDiagram
participant App as "Application"
participant Repo as "Repository"
participant Pool as "PostgreSQL Pool"
participant DB as "Database"
App->>Repo : requestCheckout(documentId, purpose, dueDate, user)
Repo->>Pool : connect()
Pool-->>Repo : client
Repo->>DB : BEGIN
Repo->>DB : INSERT INTO checkouts ...
Repo->>DB : UPDATE documents SET status='REQUESTED' WHERE id=...
Repo->>DB : COMMIT
DB-->>Repo : success
Repo-->>App : CheckoutRecord
```

**Diagram sources**
- [repository.ts:840-896](file://src/db/repository.ts#L840-L896)
- [index.ts:36-95](file://src/db/index.ts#L36-L95)

**Section sources**
- [repository.ts:840-896](file://src/db/repository.ts#L840-L896)
- [index.ts:36-95](file://src/db/index.ts#L36-L95)

## Detailed Component Analysis

### Entity Relationship Model
```mermaid
erDiagram
DEPARTMENTS {
varchar id PK
varchar code UK
varchar name
varchar head_name
integer document_count
timestamp created_at
}
USERS {
varchar id PK
varchar email UK
varchar password
varchar full_name
varchar role
varchar department_id
varchar department_name
text avatar_url
varchar title
varchar approval_status
timestamp created_at
}
DOCUMENT_TYPES {
varchar id PK
varchar code UK
varchar name
integer retention_years
text description
jsonb custom_fields
timestamp created_at
}
LOCATIONS {
varchar id PK
varchar parent_id
varchar type
varchar code UK
varchar name
text description
text image_url
integer capacity
integer current_occupancy
varchar qr_code UK
varchar barcode
varchar department_id
varchar department_name
timestamp created_at
timestamp updated_at
}
DOCUMENTS {
varchar id PK
varchar document_number UK
varchar reference_number
varchar title
varchar document_type_id
varchar document_type_name
text subject
text description
varchar department_id
varchar department_name
varchar custodian_name
varchar home_location_id
varchar current_location_id
varchar status
varchar confidentiality
varchar condition
varchar qr_code UK
varchar barcode
varchar document_date
varchar received_date
varchar filed_date
varchar retention_start_date
varchar retention_end_date
varchar disposal_date
boolean has_digital_copy
varchar digital_file_name
varchar digital_file_size
varchar digital_file_type
integer digital_file_version
jsonb custom_metadata
jsonb custom_field_values
text condition_notes
varchar bundle_id
varchar bundle_number
varchar bundle_title
timestamp created_at
timestamp updated_at
}
CHECKOUTS {
varchar id PK
varchar document_id
varchar document_number
varchar document_title
varchar requested_by_user_id
varchar requested_by_user_name
varchar requested_by_department
varchar approved_by_user_id
varchar approved_by_user_name
varchar checked_out_by_user_id
varchar checked_out_by_user_name
varchar returned_by_user_name
varchar request_date
varchar checkout_date
varchar due_date
varchar return_date
varchar status
text purpose
varchar condition_out
varchar condition_in
text notes
timestamp created_at
}
MOVEMENTS {
varchar id PK
varchar document_id
varchar document_number
varchar document_title
varchar from_location_id
text from_location_path
varchar to_location_id
text to_location_path
varchar movement_type
varchar performed_by_user_id
varchar performed_by_user_name
varchar authorized_by_user_name
text reason
timestamp timestamp
text notes
}
RETENTION_POLICIES {
varchar id PK
varchar document_type_id
varchar document_type_name
integer retention_years
varchar disposal_method
text description
}
DISPOSAL_RECORDS {
varchar id PK
varchar document_id
varchar document_number
varchar document_title
varchar requested_by_user_name
varchar approved_by_user_name
varchar disposal_date
varchar disposal_method
varchar certificate_number
varchar witness_name
text notes
}
BUNDLES {
varchar id PK
varchar bundle_number UK
varchar title
text description
varchar department_id
varchar department_name
varchar location_id
text location_path
jsonb document_ids
varchar status
varchar qr_code UK
varchar barcode
jsonb tags
timestamp created_at
timestamp updated_at
}
AUDIT_LOGS {
varchar id PK
varchar user_id
varchar user_name
varchar user_role
varchar action
varchar entity_type
varchar entity_id
varchar entity_name
timestamp timestamp
text details
text before_value
text after_value
}
DEPARTMENTS ||--o{ USERS : "has many users"
DOCUMENT_TYPES ||--o{ DOCUMENTS : "has many documents"
LOCATIONS ||--o{ LOCATIONS : "self hierarchy"
DOCUMENTS }o--|| LOCATIONS : "home/current"
DOCUMENTS ||--o{ CHECKOUTS : "many checkouts"
DOCUMENTS ||--o{ MOVEMENTS : "many movements"
DOCUMENTS ||--o{ BUNDLES : "belongs to bundle"
RETENTION_POLICIES ||--o{ DOCUMENTS : "by type"
DISPOSAL_RECORDS ||--o| DOCUMENTS : "per document"
AUDIT_LOGS }o--|| USERS : "performed by"
```

**Diagram sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)

**Section sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)

### User–Department Associations
- Relationship: Many-to-one from users to departments via department_id. The schema also stores department_name on users for convenience.
- Repository behavior:
  - Creating users persists department_id and department_name.
  - Reading users maps database rows to typed User objects including department fields.
- Integrity considerations:
  - No explicit foreign key constraint is defined in the schema; referential integrity relies on application logic and consistent writes.
  - Deleting a department does not automatically cascade to users in this implementation.

**Section sources**
- [schema.ts:12-35](file://src/db/schema.ts#L12-L35)
- [repository.ts:151-189](file://src/db/repository.ts#L151-L189)
- [repository.ts:111-149](file://src/db/repository.ts#L111-L149)

### Document-Type Mappings
- Relationship: One-to-many from document_types to documents via document_type_id; document_type_name is denormalized on documents.
- Repository behavior:
  - Creating/updating documents includes document_type_id and document_type_name.
  - Retrieval maps raw rows to typed DocumentItem including type metadata.
- Integrity considerations:
  - No explicit foreign key constraint; consistency ensured by application-level validation and updates.

**Section sources**
- [schema.ts:37-116](file://src/db/schema.ts#L37-L116)
- [repository.ts:470-519](file://src/db/repository.ts#L470-L519)
- [repository.ts:635-715](file://src/db/repository.ts#L635-L715)

### Location Hierarchies
- Relationship: Self-referencing locations table via parent_id supports hierarchical storage units (building → floor → room → cabinet → rack → shelf → box → folder).
- Repository behavior:
  - Create/update support parentId and other attributes.
  - Deletion checks for child locations and references in documents before allowing removal.
- Integrity considerations:
  - Application-level checks prevent deletion if children exist or if documents reference the location.

**Section sources**
- [schema.ts:48-65](file://src/db/schema.ts#L48-L65)
- [repository.ts:344-468](file://src/db/repository.ts#L344-L468)

### Document–Location Relationships
- Relationships:
  - Home location: home_location_id indicates where a document normally belongs.
  - Current location: current_location_id tracks transient physical location (e.g., checked out, in transit).
- Repository behavior:
  - On creation, current_location_id is initialized to home_location_id.
  - Moving documents updates current_location_id and records a movement.
- Integrity considerations:
  - No explicit foreign keys; consistency maintained by repository logic and movement logging.

**Section sources**
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [repository.ts:521-633](file://src/db/repository.ts#L521-L633)
- [repository.ts:742-804](file://src/db/repository.ts#L742-L804)

### Checkout Workflows (Documents ↔ Users)
- Entities involved:
  - checkouts: links a document to requesting/approving/checkout users and captures dates, status, conditions, and notes.
  - documents: status transitions through REQUESTED → APPROVED → CHECKED_OUT → RETURNED.
- Workflow:
  - Request: Inserts checkout record and sets document status to REQUESTED.
  - Approve: Updates checkout status to APPROVED and document status to APPROVED.
  - Dispatch: Marks checkout as CHECKED_OUT, moves document to a temporary location, updates custodian, and logs movement.
  - Return: Marks checkout as RETURNED, restores document to return location, updates condition and custodian, and logs movement.
- Consistency:
  - All steps executed within explicit transactions to ensure atomicity across checkouts and documents.

```mermaid
sequenceDiagram
participant U as "User"
participant R as "Repository"
participant D as "Documents"
participant C as "Checkouts"
participant M as "Movements"
U->>R : requestCheckout(docId, purpose, dueDate, user)
R->>C : INSERT checkout(status=REQUESTED)
R->>D : UPDATE status=REQUESTED
Note over R,D : Transaction commit
U->>R : approveCheckout(checkoutId, user)
R->>C : UPDATE status=APPROVED
R->>D : UPDATE status=APPROVED
Note over R,D : Transaction commit
U->>R : processCheckoutDispatch(checkoutId, tempLoc, user, fromPath, toPath)
R->>C : UPDATE status=CHECKED_OUT
R->>D : UPDATE current_location=tempLoc, status=CHECKED_OUT
R->>M : INSERT movement(type=CHECKOUT)
Note over R,D : Transaction commit
U->>R : processCheckInReturn(checkoutId, conditionIn, returnLoc, notes, user, fromPath, toPath)
R->>C : UPDATE status=RETURNED
R->>D : UPDATE current_location=returnLoc, status=AVAILABLE, condition=conditionIn
R->>M : INSERT movement(type=CHECKIN)
Note over R,D : Transaction commit
```

**Diagram sources**
- [repository.ts:840-1122](file://src/db/repository.ts#L840-L1122)

**Section sources**
- [schema.ts:118-148](file://src/db/schema.ts#L118-L148)
- [repository.ts:840-1122](file://src/db/repository.ts#L840-L1122)

### Movement Tracking
- Purpose: Immutable log of every physical change to a document’s location and checkout events.
- Fields capture from/to locations (IDs and paths), movement type, performing user, authorization, reason, and timestamp.
- Repository behavior:
  - Initial filing, relocations, checkouts, and check-ins each insert a movement record.
  - Movements are recorded within the same transaction as related updates to ensure consistency.

**Section sources**
- [schema.ts:150-167](file://src/db/schema.ts#L150-L167)
- [repository.ts:521-633](file://src/db/repository.ts#L521-L633)
- [repository.ts:742-804](file://src/db/repository.ts#L742-L804)
- [repository.ts:971-1122](file://src/db/repository.ts#L971-L1122)

### Bundles and Documents
- Relationship: Many-to-one from documents to bundles via bundle_id; bundles store an array of document_ids for grouping.
- Repository behavior:
  - Creating a bundle can link multiple documents atomically.
  - Updating/removing documents from a bundle updates both bundle and document records.
- Integrity considerations:
  - No explicit foreign key; consistency managed by repository updates.

**Section sources**
- [schema.ts:194-211](file://src/db/schema.ts#L194-L211)
- [repository.ts:1374-1456](file://src/db/repository.ts#L1374-L1456)
- [repository.ts:1528-1596](file://src/db/repository.ts#L1528-L1596)

### Retention Policies and Disposal Records
- Retention policies define retention years and disposal methods per document type.
- Disposal records capture the execution of disposal actions against specific documents.
- Repository behavior:
  - Read-only accessors provided for policies and disposal records.
  - Disposal records include approvers, method, certificate number, and witnesses.

**Section sources**
- [schema.ts:169-192](file://src/db/schema.ts#L169-L192)
- [repository.ts:1152-1169](file://src/db/repository.ts#L1152-L1169)

### Audit Logs
- Captures user actions across entities with before/after values when applicable.
- Repository behavior:
  - Automatically inserted for key operations like document registration, updates, moves, and bundle management.
  - Provides read accessors for auditing and compliance.

**Section sources**
- [schema.ts:213-227](file://src/db/schema.ts#L213-L227)
- [repository.ts:521-633](file://src/db/repository.ts#L521-L633)
- [repository.ts:635-715](file://src/db/repository.ts#L635-L715)
- [repository.ts:1374-1456](file://src/db/repository.ts#L1374-L1456)

## Dependency Analysis
```mermaid
graph LR
A["repository.ts"] --> B["db/index.ts (pg pool)"]
A --> C["types.ts"]
A --> D["schema.ts"]
D --> E["PostgreSQL Tables"]
```

- Coupling:
  - repository.ts depends on db/index.ts for connection pooling and on types.ts for domain models.
  - schema.ts defines table structures consumed by repository SQL statements.
- Cohesion:
  - Each repository function encapsulates a single entity’s CRUD or workflow operation, improving cohesion.
- External dependencies:
  - PostgreSQL via pg.Pool; optional Drizzle ORM instance is created but repository uses raw SQL.

**Diagram sources**
- [repository.ts:1-1597](file://src/db/repository.ts#L1-L1597)
- [index.ts:1-136](file://src/db/index.ts#L1-L136)
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [types.ts:10-283](file://src/types.ts#L10-L283)

**Section sources**
- [repository.ts:1-1597](file://src/db/repository.ts#L1-L1597)
- [index.ts:1-136](file://src/db/index.ts#L1-L136)
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [types.ts:10-283](file://src/types.ts#L10-L283)

## Performance Considerations
- Connection pooling: Uses pg.Pool with configurable timeouts and SSL handling for remote databases.
- In-memory fallback: When the database is unavailable, repository functions operate on in-memory arrays to keep the UI responsive during development or outages.
- Transactional operations: Critical workflows (create document, move document, checkouts) use explicit transactions to reduce lock contention and ensure consistency.
- Denormalized fields: Storing names alongside IDs reduces joins for common reads, improving query performance at the cost of write-time duplication.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Database connectivity:
  - If DATABASE_URL is missing or invalid, getPool returns null and repository falls back to memory mode. Use health check to diagnose.
- Transaction failures:
  - Any error in a transaction triggers rollback; repository logs warnings and may revert to memory state. Inspect logs for the failing step.
- Deletion constraints:
  - Deleting a location fails if it has child locations or referenced by documents; remove children or reassign documents first.
- Checkout conflicts:
  - Ensure document status transitions follow the expected sequence; repository enforces transitions within transactions.

Operational tips:
- Use clearCustomDataFromDb to reset operational datasets safely with cascading deletes when supported.
- Validate inputs before calling repository functions to avoid unnecessary transaction retries.

**Section sources**
- [index.ts:16-69](file://src/db/index.ts#L16-L69)
- [index.ts:97-136](file://src/db/index.ts#L97-L136)
- [repository.ts:441-468](file://src/db/repository.ts#L441-L468)
- [repository.ts:1219-1264](file://src/db/repository.ts#L1219-L1264)

## Conclusion
ArchiveHub’s data model emphasizes clarity and operational resilience:
- Clear one-to-many and many-to-one relationships between core entities, with denormalized fields optimizing read performance.
- Robust checkout and movement workflows backed by explicit transactions to maintain consistency across related tables.
- Flexible location hierarchy enabling precise physical tracking.
- Comprehensive audit logging and retention/disposal support for compliance.
The repository layer abstracts complex multi-table operations behind simple functions, providing both PostgreSQL-backed persistence and resilient in-memory fallbacks.

[No sources needed since this section summarizes without analyzing specific files]