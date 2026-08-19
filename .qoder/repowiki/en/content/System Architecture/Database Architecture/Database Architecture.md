# Database Architecture

<cite>
**Referenced Files in This Document**
- [schema.ts](file://src/db/schema.ts)
- [migrate.ts](file://src/db/migrate.ts)
- [repository.ts](file://src/db/repository.ts)
- [index.ts](file://src/db/index.ts)
- [types.ts](file://src/types.ts)
- [server.ts](file://server.ts)
- [session.ts](file://src/auth/session.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes the PostgreSQL database architecture for ArchiveHub’s physical and digital archive management system. It covers all 11 core tables (departments, users, document types, locations, documents, checkouts, movements, retention policies, disposal records, bundles, audit logs), entity relationships, data integrity rules, repository pattern implementation, migration strategy, indexing recommendations, backup/recovery procedures, JSONB usage for flexible metadata, and security considerations including password hashing, access controls, and audit logging.

## Project Structure
The database layer is implemented with:
- Schema definitions using Drizzle ORM pg-core
- Migration script that creates tables and columns idempotently
- A repository module that abstracts data access and provides fallback to in-memory storage when PostgreSQL is unavailable
- Server startup that checks DB health, runs migrations, and seeds initial data

```mermaid
graph TB
Client["Client App"] --> API["Express API (server.ts)"]
API --> Repo["Repository Layer (repository.ts)"]
Repo --> Pool["PostgreSQL Pool (index.ts)"]
Pool --> DB["PostgreSQL Database"]
Repo --> Memory["In-Memory Fallback"]
```

**Diagram sources**
- [server.ts:13-38](file://server.ts#L13-L38)
- [repository.ts:106-119](file://src/db/repository.ts#L106-L119)
- [index.ts:36-69](file://src/db/index.ts#L36-L69)

**Section sources**
- [server.ts:13-38](file://server.ts#L13-L38)
- [index.ts:16-69](file://src/db/index.ts#L16-L69)

## Core Components
- Schema definitions define 11+ tables with primary keys, unique constraints, defaults, and timestamps.
- Migration script ensures schema creation and safe column additions.
- Repository functions encapsulate CRUD operations, transactions, and audit logging.
- Types define domain models used across the application.

Key responsibilities:
- Data modeling and constraints: [schema.ts](file://src/db/schema.ts)
- Idempotent migrations: [migrate.ts](file://src/db/migrate.ts)
- Data access abstraction and fallback: [repository.ts](file://src/db/repository.ts)
- Connection pooling and health checks: [index.ts](file://src/db/index.ts)
- Domain types and enums: [types.ts](file://src/types.ts)

**Section sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [migrate.ts:16-266](file://src/db/migrate.ts#L16-L266)
- [repository.ts:110-1217](file://src/db/repository.ts#L110-L1217)
- [index.ts:36-136](file://src/db/index.ts#L36-L136)
- [types.ts:10-283](file://src/types.ts#L10-L283)

## Architecture Overview
High-level flow from request to persistence:
- Express routes call repository methods
- Repository executes SQL via a pooled client or falls back to memory
- Transactions ensure consistency for multi-step operations
- Audit logs are recorded for critical actions

```mermaid
sequenceDiagram
participant C as "Client"
participant S as "Server (server.ts)"
participant R as "Repository (repository.ts)"
participant P as "Pool (index.ts)"
participant D as "PostgreSQL"
C->>S : HTTP Request
S->>R : Call repository method
R->>P : getPool() / connect()
alt DB available
R->>D : BEGIN/COMMIT transaction
D-->>R : Rows affected
R-->>S : Result
else DB unavailable
R->>R : Update in-memory state
R-->>S : Result
end
S-->>C : JSON Response
```

**Diagram sources**
- [server.ts:19-38](file://server.ts#L19-L38)
- [repository.ts:571-632](file://src/db/repository.ts#L571-L632)
- [index.ts:36-69](file://src/db/index.ts#L36-L69)

## Detailed Component Analysis

### Entity Relationship Model
The following diagram maps the core entities and their relationships as defined by the schema and repository logic.

```mermaid
erDiagram
departments {
varchar id PK
varchar code UK
varchar name
varchar head_name
integer document_count
timestamptz created_at
}
users {
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
timestamptz created_at
}
document_types {
varchar id PK
varchar code UK
varchar name
integer retention_years
text description
jsonb custom_fields
timestamptz created_at
}
locations {
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
timestamptz created_at
timestamptz updated_at
}
documents {
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
timestamptz created_at
timestamptz updated_at
}
checkouts {
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
timestamptz created_at
}
movements {
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
timestamptz timestamp
text notes
}
retention_policies {
varchar id PK
varchar document_type_id
varchar document_type_name
integer retention_years
varchar disposal_method
text description
}
disposal_records {
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
bundles {
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
timestamptz created_at
timestamptz updated_at
}
audit_logs {
varchar id PK
varchar user_id
varchar user_name
varchar user_role
varchar action
varchar entity_type
varchar entity_id
varchar entity_name
timestamptz timestamp
text details
text before_value
text after_value
}
users ||--o{ documents : "department ownership"
departments ||--o{ users : "belongs to"
document_types ||--o{ documents : "type"
locations ||--o{ documents : "home/current"
locations ||--o{ locations : "parent-child"
documents ||--o{ checkouts : "checked out"
documents ||--o{ movements : "moved"
document_types ||--o{ retention_policies : "policy"
documents ||--o{ disposal_records : "disposed"
bundles ||--o{ documents : "contains (via ids)"
users ||--o{ audit_logs : "performed by"
```

**Diagram sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [migrate.ts:16-266](file://src/db/migrate.ts#L16-L266)

**Section sources**
- [schema.ts:12-228](file://src/db/schema.ts#L12-L228)
- [migrate.ts:16-266](file://src/db/migrate.ts#L16-L266)

### Table-by-Table Analysis

#### Departments
- Purpose: Organizational units owning records and users.
- Key fields: id (PK), code (unique), name, head_name, document_count, created_at.
- Integrity: Unique code prevents duplicates; numeric count can be maintained by triggers or application logic.

**Section sources**
- [schema.ts:12-20](file://src/db/schema.ts#L12-L20)
- [migrate.ts:16-26](file://src/db/migrate.ts#L16-L26)

#### Users
- Purpose: System users with roles and department association.
- Key fields: id (PK), email (unique), password, full_name, role, department_id/name, approval_status, created_at.
- Integrity: Unique email; approval workflow enforced at login.

**Section sources**
- [schema.ts:22-35](file://src/db/schema.ts#L22-L35)
- [migrate.ts:28-49](file://src/db/migrate.ts#L28-L49)
- [server.ts:104-150](file://server.ts#L104-L150)

#### Document Types
- Purpose: Classifies documents and defines retention and custom field schemas.
- Key fields: id (PK), code (unique), name, retention_years, description, custom_fields (JSONB), created_at.
- Integrity: Unique code; JSONB stores flexible field definitions.

**Section sources**
- [schema.ts:37-46](file://src/db/schema.ts#L37-L46)
- [migrate.ts:51-66](file://src/db/migrate.ts#L51-L66)

#### Locations (Hierarchical)
- Purpose: Physical hierarchy (building/floor/room/cabinet/rack/shelf/box/folder).
- Key fields: id (PK), parent_id (self-reference), type, code (unique), name, capacity, occupancy, qr_code (unique), barcode, department_id/name, timestamps.
- Integrity: Unique code and QR; hierarchical traversal via parent_id.

**Section sources**
- [schema.ts:48-65](file://src/db/schema.ts#L48-L65)
- [migrate.ts:68-87](file://src/db/migrate.ts#L68-L87)

#### Documents
- Purpose: Core record of each physical/digital item.
- Key fields: id (PK), document_number (unique), type references, department, custodian, home/current locations, status/confidentiality/condition, identifiers, dates, digital copy flags, JSONB metadata, bundle links, timestamps.
- Integrity: Unique document_number and qr_code; required fields enforce completeness.

**Section sources**
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [migrate.ts:89-133](file://src/db/migrate.ts#L89-L133)

#### Checkouts
- Purpose: Tracks borrowing lifecycle with approvals and conditions.
- Key fields: id (PK), document refs, requester/approver/checkout/return actors, dates, status, purpose, conditions, notes, created_at.

**Section sources**
- [schema.ts:118-148](file://src/db/schema.ts#L118-L148)
- [migrate.ts:135-161](file://src/db/migrate.ts#L135-L161)

#### Movements
- Purpose: Immutable trail of physical moves between locations.
- Key fields: id (PK), document refs, from/to locations and paths, movement_type, actor names, reason, timestamp, notes.

**Section sources**
- [schema.ts:150-167](file://src/db/schema.ts#L150-L167)
- [migrate.ts:163-182](file://src/db/migrate.ts#L163-L182)

#### Retention Policies
- Purpose: Policy per document type specifying retention period and disposal method.
- Key fields: id (PK), document_type_id/name, retention_years, disposal_method, description.

**Section sources**
- [schema.ts:169-177](file://src/db/schema.ts#L169-L177)
- [migrate.ts:184-194](file://src/db/migrate.ts#L184-L194)

#### Disposal Records
- Purpose: Audit trail for destruction/disposal events.
- Key fields: id (PK), document refs, approvers, date, method, certificate, witness, notes.

**Section sources**
- [schema.ts:179-192](file://src/db/schema.ts#L179-L192)
- [migrate.ts:196-211](file://src/db/migrate.ts#L196-L211)

#### Bundles & Dossiers
- Purpose: Group related documents into logical bundles with shared metadata and location.
- Key fields: id (PK), bundle_number (unique), title, department/location refs, document_ids (JSONB array), status, identifiers, tags (JSONB), timestamps.

**Section sources**
- [schema.ts:194-211](file://src/db/schema.ts#L194-L211)
- [migrate.ts:247-266](file://src/db/migrate.ts#L247-L266)

#### Audit Logs
- Purpose: Immutable ledger of significant actions with before/after snapshots.
- Key fields: id (PK), user refs, action/entity/type/id/name, timestamp, details, before/after values.

**Section sources**
- [schema.ts:213-228](file://src/db/schema.ts#L213-L228)
- [migrate.ts:213-229](file://src/db/migrate.ts#L213-L229)

### Repository Pattern Implementation
The repository abstracts data access and provides resilience:
- DB availability detection and fallback to in-memory arrays when PostgreSQL is not configured or fails.
- Transactional writes for complex operations (e.g., document registration, movement).
- Consistent mapping of rows to typed objects.
- Centralized audit logging on key mutations.

Key patterns:
- Fallback guard: [repository.ts:106-119](file://src/db/repository.ts#L106-L119)
- User CRUD with hashing: [repository.ts:151-239](file://src/db/repository.ts#L151-L239)
- Location hierarchy safety: [repository.ts:441-468](file://src/db/repository.ts#L441-L468)
- Document create with transaction and audit: [repository.ts:571-632](file://src/db/repository.ts#L571-L632)
- Movement recording with transaction and audit: [repository.ts:742-804](file://src/db/repository.ts#L742-L804)
- Audit log creation: [repository.ts:1196-1217](file://src/db/repository.ts#L1196-L1217)

**Section sources**
- [repository.ts:106-1217](file://src/db/repository.ts#L106-L1217)

### Query Optimization Strategies
Current queries are simple selects/inserts/updates without explicit indexes beyond declared unique constraints. Recommended optimizations:
- Indexes on frequently filtered/joined columns:
  - documents: document_number, document_type_id, department_id, status, current_location_id, home_location_id
  - checkouts: document_id, status, due_date
  - movements: document_id, timestamp
  - locations: parent_id, type, code
  - audit_logs: timestamp, entity_type, entity_id, user_id
- Use partial indexes for high-cardinality filters (e.g., overdue checkouts).
- Avoid SELECT * in production; project only needed columns.
- Batch inserts where possible for bulk operations.

[No sources needed since this section provides general guidance]

### Migration Strategy Using Drizzle Migrations
- The migration script uses raw SQL within a transaction to create tables and add columns idempotently.
- On server start, migrations run automatically if DB is connected; otherwise, the app continues in memory mode.
- Seed data is applied after successful migration.

Operational steps:
- Ensure DATABASE_URL is configured; otherwise, fallback to memory mode.
- Run migrations once per environment; subsequent runs are no-ops due to IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
- Use the seed endpoint to reset operational data safely.

**Section sources**
- [server.ts:19-38](file://server.ts#L19-L38)
- [migrate.ts:3-277](file://src/db/migrate.ts#L3-L277)

### Backup and Recovery Procedures
Recommended practices:
- Logical backups:
  - Use pg_dump to export schema and data periodically.
  - Schedule incremental backups for large datasets.
- Point-in-time recovery:
  - Enable WAL archiving and configure PITR to recover to specific timestamps.
- Disaster recovery:
  - Maintain offsite copies of dumps and WAL archives.
  - Test restore procedures regularly.
- Operational data clearing:
  - Use provided clear-data endpoint to truncate operational tables safely.

**Section sources**
- [server.ts:74-82](file://server.ts#L74-L82)
- [repository.ts:1219-1257](file://src/db/repository.ts#L1219-L1257)

### JSONB Fields Usage
Flexible metadata storage:
- document_types.custom_fields: Array of custom field definitions for dynamic forms.
- documents.custom_metadata: List of key/value pairs for ad-hoc attributes.
- documents.custom_field_values: Map of field values keyed by definition names.
- bundles.document_ids: Array of document IDs included in a bundle.
- bundles.tags: Array of tags for categorization.

Usage patterns:
- Store structured but evolving metadata without schema changes.
- Validate and normalize values at the application layer before persisting.
- Query JSONB selectively using PostgreSQL operators for performance.

**Section sources**
- [schema.ts:44-45](file://src/db/schema.ts#L44-L45)
- [schema.ts:106-107](file://src/db/schema.ts#L106-L107)
- [schema.ts:204-208](file://src/db/schema.ts#L204-L208)
- [migrate.ts:59-62](file://src/db/migrate.ts#L59-L62)
- [migrate.ts:121-122](file://src/db/migrate.ts#L121-L122)
- [migrate.ts:258-262](file://src/db/migrate.ts#L258-L262)

### Security Considerations

#### Password Hashing and Authentication
- Passwords are hashed using bcrypt before storage.
- Login verifies approval status and compares passwords securely.
- JWT tokens are signed with a session secret for short-lived sessions.

Implementation highlights:
- Hashing utility: [session.ts:34-48](file://src/auth/session.ts#L34-L48)
- Token signing/verification: [session.ts:50-65](file://src/auth/session.ts#L50-L65)
- Login flow and approval checks: [server.ts:104-150](file://server.ts#L104-L150)

**Section sources**
- [session.ts:34-65](file://src/auth/session.ts#L34-L65)
- [server.ts:104-150](file://server.ts#L104-L150)

#### Access Controls
- Role-based access is modeled via users.role; enforce authorization at service layer.
- Approval workflow restricts login until admin approves accounts.

**Section sources**
- [schema.ts:28-34](file://src/db/schema.ts#L28-L34)
- [server.ts:122-138](file://server.ts#L122-L138)

#### Audit Logging Mechanisms
- Critical actions (create/update/move/document registration) write immutable audit entries.
- Before/after snapshots stored for change tracking.

Implementation highlights:
- Audit insertion on document updates and movements: [repository.ts:635-715](file://src/db/repository.ts#L635-L715), [repository.ts:742-804](file://src/db/repository.ts#L742-L804)
- Audit retrieval endpoints: [server.ts:463-480](file://server.ts#L463-L480)

**Section sources**
- [repository.ts:635-804](file://src/db/repository.ts#L635-L804)
- [server.ts:463-480](file://server.ts#L463-L480)

## Dependency Analysis
The repository depends on the pool and schema; the server orchestrates migrations and seeds.

```mermaid
graph LR
Server["server.ts"] --> Repo["repository.ts"]
Repo --> Index["index.ts"]
Repo --> Schema["schema.ts"]
Repo --> Types["types.ts"]
Server --> Migrate["migrate.ts"]
```

**Diagram sources**
- [server.ts:8-11](file://server.ts#L8-L11)
- [repository.ts:1-15](file://src/db/repository.ts#L1-L15)
- [index.ts:1-7](file://src/db/index.ts#L1-L7)
- [migrate.ts:1-2](file://src/db/migrate.ts#L1-L2)

**Section sources**
- [server.ts:8-11](file://server.ts#L8-L11)
- [repository.ts:1-15](file://src/db/repository.ts#L1-L15)
- [index.ts:1-7](file://src/db/index.ts#L1-L7)
- [migrate.ts:1-2](file://src/db/migrate.ts#L1-L2)

## Performance Considerations
- Prefer targeted column selection instead of SELECT *.
- Add indexes on high-frequency filter/join columns as recommended above.
- Use transactions for multi-step writes to reduce lock contention and ensure consistency.
- Monitor query plans for expensive operations and consider materialized views for heavy reporting.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Database not connected:
  - Verify DATABASE_URL in .env; health check will report failure and app falls back to memory.
  - Use /api/health to inspect connection status.
- Migration failures:
  - Review migration logs; errors trigger rollback; fix schema and re-run.
- Clearing operational data:
  - Use POST /api/clear-data to truncate operational tables safely.

Operational endpoints:
- Health check: GET /api/health
- Seed/reset: POST /api/seed
- Clear data: POST /api/clear-data

**Section sources**
- [server.ts:19-38](file://server.ts#L19-L38)
- [server.ts:43-82](file://server.ts#L43-L82)
- [repository.ts:1219-1257](file://src/db/repository.ts#L1219-L1257)

## Conclusion
ArchiveHub’s database architecture provides a robust foundation for managing physical and digital records with strong data integrity, flexible metadata via JSONB, comprehensive audit trails, and resilient operation through a repository pattern with in-memory fallback. With proper indexing, secure authentication, and disciplined backup/recovery procedures, the system supports scalable and compliant archival workflows.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Appendix A: Data Flow Sequence for Document Registration
```mermaid
sequenceDiagram
participant U as "User"
participant S as "Server"
participant R as "Repository"
participant D as "Database"
U->>S : Create Document
S->>R : createDocument(...)
R->>D : BEGIN
R->>D : INSERT documents
R->>D : INSERT movements (initial filing)
R->>D : INSERT audit_logs
R->>D : COMMIT
D-->>R : Success
R-->>S : Document object
S-->>U : 201 Created
```

**Diagram sources**
- [repository.ts:571-632](file://src/db/repository.ts#L571-L632)

### Appendix B: Data Flow Sequence for Document Movement
```mermaid
sequenceDiagram
participant U as "User"
participant S as "Server"
participant R as "Repository"
participant D as "Database"
U->>S : Move Document
S->>R : moveDocument(...)
R->>D : BEGIN
R->>D : UPDATE documents.current_location_id
R->>D : INSERT movements
R->>D : INSERT audit_logs
R->>D : COMMIT
D-->>R : Success
R-->>S : OK
S-->>U : 200 OK
```

**Diagram sources**
- [repository.ts:742-804](file://src/db/repository.ts#L742-L804)