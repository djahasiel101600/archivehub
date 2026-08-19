# System Endpoints

<cite>
**Referenced Files in This Document**
- [server.ts](file://server.ts)
- [apiGuard.ts](file://src/auth/apiGuard.ts)
- [index.ts](file://src/db/index.ts)
- [repository.ts](file://src/db/repository.ts)
- [migrate.ts](file://src/db/migrate.ts)
- [seed.ts](file://src/db/seed.ts)
- [types.ts](file://src/types.ts)
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

## Introduction
This document provides API documentation for ArchiveHub’s system administration and monitoring endpoints. It covers:
- Health check endpoint GET /api/health for service status monitoring, including database connectivity checks and timestamp reporting.
- Database management endpoints POST /api/seed for initial data seeding and migration execution, and POST /api/clear-data for operational data cleanup.
- Audit log endpoints GET /api/audit-logs for compliance monitoring and POST /api/audit-logs for logging significant actions.
- User management endpoints GET /api/users for user listing and DELETE /api/users/:id for user removal.

For each endpoint, this document specifies request/response formats, error handling behavior, and administrative access requirements.

## Project Structure
The server exposes REST endpoints under the /api prefix. Authentication and authorization are enforced by a middleware guard that validates tokens and role-based permissions. Data operations are implemented via repository functions that interact with PostgreSQL when available or fall back to in-memory state otherwise.

```mermaid
graph TB
Client["Client"] --> Server["Express Server<br/>server.ts"]
Server --> Guard["API Guard<br/>src/auth/apiGuard.ts"]
Server --> Health["GET /api/health"]
Server --> Seed["POST /api/seed"]
Server --> Clear["POST /api/clear-data"]
Server --> UsersList["GET /api/users"]
Server --> UsersDelete["DELETE /api/users/:id"]
Server --> AuditGet["GET /api/audit-logs"]
Server --> AuditPost["POST /api/audit-logs"]
Guard --> Repo["Repository<br/>src/db/repository.ts"]
Repo --> DB["PostgreSQL Pool<br/>src/db/index.ts"]
Seed --> Migrate["runMigrations<br/>src/db/migrate.ts"]
Seed --> SeedDB["seedDatabase<br/>src/db/seed.ts"]
```

**Diagram sources**
- [server.ts:43-82](file://server.ts#L43-L82)
- [server.ts:95-213](file://server.ts#L95-L213)
- [server.ts:464-480](file://server.ts#L464-L480)
- [apiGuard.ts:11-17](file://src/auth/apiGuard.ts#L11-L17)
- [apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [index.ts:97-135](file://src/db/index.ts#L97-L135)
- [migrate.ts:3-278](file://src/db/migrate.ts#L3-L278)
- [seed.ts:3-23](file://src/db/seed.ts#L3-L23)

**Section sources**
- [server.ts:43-82](file://server.ts#L43-L82)
- [server.ts:95-213](file://server.ts#L95-L213)
- [server.ts:464-480](file://server.ts#L464-L480)
- [apiGuard.ts:11-17](file://src/auth/apiGuard.ts#L11-L17)
- [apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [index.ts:97-135](file://src/db/index.ts#L97-L135)
- [migrate.ts:3-278](file://src/db/migrate.ts#L3-L278)
- [seed.ts:3-23](file://src/db/seed.ts#L3-L23)

## Core Components
- Health Check: Returns service status, database health, and timestamp.
- Database Management:
  - Seed: Runs migrations and seeds default data if permitted.
  - Clear Data: Truncates operational tables (cascade) or deletes records as fallback.
- Audit Logs:
  - Get: Retrieves audit logs ordered by timestamp.
  - Post: Creates an audit log entry.
- User Management:
  - List: Returns users from the repository.
  - Delete: Removes a user by ID.

Access control:
- Public endpoints: GET /api/health is public; other admin endpoints require authentication and appropriate roles.
- Role enforcement:
  - /api/users and /api/seed and /api/clear-data require ADMIN role.
  - POST /api/audit-logs is allowed without additional role checks beyond authentication.

**Section sources**
- [server.ts:43-82](file://server.ts#L43-L82)
- [server.ts:95-213](file://server.ts#L95-L213)
- [server.ts:464-480](file://server.ts#L464-L480)
- [apiGuard.ts:11-17](file://src/auth/apiGuard.ts#L11-L17)
- [apiGuard.ts:64-66](file://src/auth/apiGuard.ts#L64-L66)
- [apiGuard.ts:88-90](file://src/auth/apiGuard.ts#L88-L90)

## Architecture Overview
The server defines Express routes that call repository functions. Repository functions use a PostgreSQL pool when configured; otherwise they operate on in-memory arrays. The API guard enforces authentication and role-based authorization for protected endpoints.

```mermaid
sequenceDiagram
participant C as "Client"
participant S as "Server (server.ts)"
participant G as "API Guard (apiGuard.ts)"
participant R as "Repository (repository.ts)"
participant D as "DB Pool (index.ts)"
C->>S : GET /api/health
S->>D : checkDatabaseHealth()
D-->>S : { connected, message, timestamp }
S-->>C : { status, service, database, timestamp }
C->>S : POST /api/seed
S->>G : apiGuard(req,res,next)
G-->>S : allow if ADMIN
S->>R : runMigrations()
S->>R : seedDatabase(force=true)
S-->>C : { success, message }
C->>S : POST /api/clear-data
S->>G : apiGuard(req,res,next)
G-->>S : allow if ADMIN
S->>R : clearCustomDataFromDb()
S-->>C : { success, message }
C->>S : GET /api/users
S->>G : apiGuard(req,res,next)
G-->>S : allow if ADMIN or AUDITOR
S->>R : getUsers()
S-->>C : User[]
C->>S : DELETE /api/users/ : id
S->>G : apiGuard(req,res,next)
G-->>S : allow if ADMIN
S->>R : deleteUser(id)
S-->>C : { success }
C->>S : GET /api/audit-logs
S->>R : getAuditLogs()
S-->>C : AuditLogRecord[]
C->>S : POST /api/audit-logs
S->>R : createAuditLog(body)
S-->>C : AuditLogRecord
```

**Diagram sources**
- [server.ts:43-82](file://server.ts#L43-L82)
- [server.ts:95-213](file://server.ts#L95-L213)
- [server.ts:464-480](file://server.ts#L464-L480)
- [apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [index.ts:97-135](file://src/db/index.ts#L97-L135)
- [repository.ts:1172-1264](file://src/db/repository.ts#L1172-L1264)

## Detailed Component Analysis

### Health Check: GET /api/health
- Purpose: Service status monitoring including database connectivity checks and timestamp reporting.
- Access: Public (no authentication required).
- Request: None.
- Response:
  - status: string ("ok")
  - service: string ("ArchiveHub PDAMS Backend API")
  - database: object with fields:
    - connected: boolean
    - message: string
    - timestamp: string (ISO 8601)
  - timestamp: string (ISO 8601)
- Error Handling:
  - If database connection fails, database.connected will be false and database.message describes the issue.
- Notes:
  - On startup, the server attempts migrations and seeding if connected; failures are logged but do not block server start.

**Section sources**
- [server.ts:43-51](file://server.ts#L43-L51)
- [index.ts:97-135](file://src/db/index.ts#L97-L135)
- [server.ts:19-38](file://server.ts#L19-L38)

### Database Management: POST /api/seed
- Purpose: Execute schema migrations and load initial seed data.
- Access: Requires ADMIN role.
- Request: None.
- Response:
  - success: boolean
  - message: string
- Behavior:
  - Checks database connectivity; returns 400 with error if not connected.
  - Executes migrations then seeds with force flag to ensure defaults are loaded.
- Errors:
  - 400: Database not connected.
  - 500: Internal error during migration/seed.

**Section sources**
- [server.ts:54-72](file://server.ts#L54-L72)
- [migrate.ts:3-278](file://src/db/migrate.ts#L3-L278)
- [seed.ts:3-23](file://src/db/seed.ts#L3-L23)
- [apiGuard.ts:64-66](file://src/auth/apiGuard.ts#L64-L66)

### Database Management: POST /api/clear-data
- Purpose: Operational data cleanup by truncating or deleting operational tables.
- Access: Requires ADMIN role.
- Request: None.
- Response:
  - success: boolean
  - message: string
- Behavior:
  - Clears in-memory operational datasets.
  - Attempts TRUNCATE CASCADE on PostgreSQL; falls back to transactional DELETE queries if needed.
- Errors:
  - 500: Internal error; response includes error message.

**Section sources**
- [server.ts:75-82](file://server.ts#L75-L82)
- [repository.ts:1219-1264](file://src/db/repository.ts#L1219-L1264)
- [apiGuard.ts:64-66](file://src/auth/apiGuard.ts#L64-L66)

### Audit Logs: GET /api/audit-logs
- Purpose: Compliance monitoring by retrieving audit log entries.
- Access: Requires authentication; no specific role restriction beyond auth.
- Request: None.
- Response: Array of audit log records with fields:
  - id: string
  - userId: string
  - userName: string
  - userRole: string
  - action: string
  - entityType: string
  - entityId: string
  - entityName: string
  - timestamp: string (ISO 8601)
  - details: string
  - beforeValue?: string
  - afterValue?: string
- Errors:
  - 500: Internal error; response includes error message.

**Section sources**
- [server.ts:464-471](file://server.ts#L464-L471)
- [repository.ts:1172-1194](file://src/db/repository.ts#L1172-L1194)
- [apiGuard.ts:88-90](file://src/auth/apiGuard.ts#L88-L90)

### Audit Logs: POST /api/audit-logs
- Purpose: Log significant actions for compliance.
- Access: Requires authentication; no additional role restriction beyond auth.
- Request Body: Object conforming to AuditLogRecord excluding id and timestamp:
  - userId: string
  - userName: string
  - userRole: string
  - action: string
  - entityType: string
  - entityId: string
  - entityName: string
  - details: string
  - beforeValue?: string
  - afterValue?: string
- Response:
  - 201: Created with full AuditLogRecord including generated id and timestamp.
- Errors:
  - 500: Internal error; response includes error message.

**Section sources**
- [server.ts:473-480](file://server.ts#L473-L480)
- [repository.ts:1196-1217](file://src/db/repository.ts#L1196-L1217)
- [apiGuard.ts:88-90](file://src/auth/apiGuard.ts#L88-L90)
- [types.ts:260-274](file://src/types.ts#L260-L274)

### User Management: GET /api/users
- Purpose: List users for administrative review.
- Access: Requires ADMIN role or AUDITOR role (read-only).
- Request: None.
- Response: Array of User objects with fields:
  - id: string
  - email: string
  - fullName: string
  - role: string
  - departmentId: string
  - departmentName: string
  - avatarUrl?: string
  - title?: string
  - approvalStatus?: string
  - createdAt?: string
- Errors:
  - 500: Internal error; response includes error message.

**Section sources**
- [server.ts:95-102](file://server.ts#L95-L102)
- [repository.ts:111-120](file://src/db/repository.ts#L111-L120)
- [apiGuard.ts:53-58](file://src/auth/apiGuard.ts#L53-L58)
- [types.ts:10-22](file://src/types.ts#L10-L22)

### User Management: DELETE /api/users/:id
- Purpose: Remove a user by ID.
- Access: Requires ADMIN role.
- Request: Path parameter id (string).
- Response:
  - success: boolean
- Errors:
  - 500: Internal error; response includes error message.

**Section sources**
- [server.ts:206-213](file://server.ts#L206-L213)
- [repository.ts:226-239](file://src/db/repository.ts#L226-L239)
- [apiGuard.ts:64-66](file://src/auth/apiGuard.ts#L64-L66)

## Dependency Analysis
- Server routes depend on repository functions for data operations.
- Repository functions depend on PostgreSQL pool availability; if unavailable, they operate on in-memory arrays.
- API guard enforces authentication and role-based access for protected endpoints.
- Migration and seed functions are invoked by the seed endpoint and at server startup.

```mermaid
graph LR
A["server.ts"] --> B["src/auth/apiGuard.ts"]
A --> C["src/db/repository.ts"]
C --> D["src/db/index.ts"]
A --> E["src/db/migrate.ts"]
A --> F["src/db/seed.ts"]
```

**Diagram sources**
- [server.ts:43-82](file://server.ts#L43-L82)
- [server.ts:95-213](file://server.ts#L95-L213)
- [server.ts:464-480](file://server.ts#L464-L480)
- [apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [repository.ts:1172-1264](file://src/db/repository.ts#L1172-L1264)
- [index.ts:97-135](file://src/db/index.ts#L97-L135)
- [migrate.ts:3-278](file://src/db/migrate.ts#L3-L278)
- [seed.ts:3-23](file://src/db/seed.ts#L3-L23)

**Section sources**
- [server.ts:43-82](file://server.ts#L43-L82)
- [server.ts:95-213](file://server.ts#L95-L213)
- [server.ts:464-480](file://server.ts#L464-L480)
- [apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [repository.ts:1172-1264](file://src/db/repository.ts#L1172-L1264)
- [index.ts:97-135](file://src/db/index.ts#L97-L135)
- [migrate.ts:3-278](file://src/db/migrate.ts#L3-L278)
- [seed.ts:3-23](file://src/db/seed.ts#L3-L23)

## Performance Considerations
- Health checks perform a lightweight database probe; avoid excessive polling to reduce load.
- Clear-data performs cascade truncation or multiple delete statements; consider scheduling during low-traffic windows.
- Audit log writes are simple inserts; high-frequency logging should be batched at the client layer if necessary.
- Repository functions fall back to in-memory mode when database is unavailable; this can affect consistency and durability.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and responses:
- Health check reports database disconnected:
  - Ensure DATABASE_URL is configured and valid; check .env parsing and placeholder password detection.
- Seed endpoint returns 400:
  - Database not connected; configure DATABASE_URL and verify connectivity.
- Clear-data returns failure:
  - TRUNCATE may fail due to constraints; the function attempts transactional deletes as fallback. Review error message for specifics.
- User endpoints return 401/403:
  - Missing or invalid token; account not approved; insufficient role (ADMIN required for user deletion and list where applicable).
- Audit log endpoints return 500:
  - Database write failed; check PostgreSQL connectivity and table schema.

**Section sources**
- [index.ts:16-34](file://src/db/index.ts#L16-L34)
- [index.ts:97-135](file://src/db/index.ts#L97-L135)
- [server.ts:54-72](file://server.ts#L54-L72)
- [server.ts:75-82](file://server.ts#L75-L82)
- [apiGuard.ts:27-48](file://src/auth/apiGuard.ts#L27-L48)
- [repository.ts:1219-1264](file://src/db/repository.ts#L1219-L1264)

## Conclusion
ArchiveHub’s system endpoints provide essential administrative capabilities:
- Health monitoring with database connectivity checks and timestamps.
- Database lifecycle management through seeding and clearing operational data.
- Audit logging for compliance and accountability.
- User management for listing and removing users.

Administrative endpoints enforce strict role-based access, while health checks remain publicly accessible for monitoring purposes. Proper configuration of DATABASE_URL and adherence to role requirements are critical for reliable operation.

[No sources needed since this section summarizes without analyzing specific files]