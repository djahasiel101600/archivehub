# Authentication & Security

<cite>
**Referenced Files in This Document**
- [server.ts](file://server.ts)
- [src/auth/apiGuard.ts](file://src/auth/apiGuard.ts)
- [src/auth/session.ts](file://src/auth/session.ts)
- [src/db/schema.ts](file://src/db/schema.ts)
- [src/db/repository.ts](file://src/db/repository.ts)
- [src/types.ts](file://src/types.ts)
- [src/components/auth/AuthPage.tsx](file://src/components/auth/AuthPage.tsx)
- [src/context/ArchiveContext.tsx](file://src/context/ArchiveContext.tsx)
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
This document explains ArchiveHub’s authentication and security model, focusing on role-based access control (RBAC), JWT-based authentication flows, API guard middleware, password hashing with bcryptjs, secure session handling, and protection against common web vulnerabilities. It also covers the user registration workflow with approval processes and permission assignment, and provides guidance for implementing custom guards and extending roles.

## Project Structure
The authentication and authorization logic is primarily implemented across:
- Server routes that handle login/signup and data endpoints
- An API guard middleware that validates tokens and enforces permissions
- Session utilities for token signing/verification and password hashing
- Database schema and repository layer for users, departments, and audit logs
- Frontend components and context for sign-in/sign-up flows and local session persistence

```mermaid
graph TB
Client["Client App"] --> Routes["Express Routes<br/>server.ts"]
Routes --> Guard["API Guard Middleware<br/>apiGuard.ts"]
Guard --> Repo["Repository Layer<br/>repository.ts"]
Repo --> Schema["DB Schema<br/>schema.ts"]
Guard --> Session["Session Utils<br/>session.ts"]
Client --> UI["Auth UI<br/>AuthPage.tsx"]
UI --> Ctx["Archive Context<br/>ArchiveContext.tsx"]
```

**Diagram sources**
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/auth/apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [src/auth/session.ts:23-65](file://src/auth/session.ts#L23-L65)
- [src/db/repository.ts:111-189](file://src/db/repository.ts#L111-L189)
- [src/db/schema.ts:22-35](file://src/db/schema.ts#L22-L35)
- [src/components/auth/AuthPage.tsx:51-120](file://src/components/auth/AuthPage.tsx#L51-L120)
- [src/context/ArchiveContext.tsx:118-158](file://src/context/ArchiveContext.tsx#L118-L158)

**Section sources**
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/auth/apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [src/auth/session.ts:23-65](file://src/auth/session.ts#L23-L65)
- [src/db/schema.ts:22-35](file://src/db/schema.ts#L22-L35)
- [src/db/repository.ts:111-189](file://src/db/repository.ts#L111-L189)
- [src/components/auth/AuthPage.tsx:51-120](file://src/components/auth/AuthPage.tsx#L51-L120)
- [src/context/ArchiveContext.tsx:118-158](file://src/context/ArchiveContext.tsx#L118-L158)

## Core Components
- Role-Based Access Control (RBAC): Roles are defined as a typed set and enforced by the API guard to restrict access to specific endpoints.
- JWT Authentication: Tokens are signed with a secret and verified per request; payloads include user id, email, and role.
- Password Hashing: Uses bcryptjs with a configurable salt rounds; supports both hashed and legacy plain comparisons during migration.
- Approval Workflow: New registrations are pending until an administrator approves them; login checks approval status before granting access.
- Secure Session Handling: Token TTL is set; secrets are read from environment variables with safe fallbacks for development.

**Section sources**
- [src/types.ts:6-22](file://src/types.ts#L6-L22)
- [src/auth/apiGuard.ts:6-97](file://src/auth/apiGuard.ts#L6-L97)
- [src/auth/session.ts:23-65](file://src/auth/session.ts#L23-L65)
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/db/repository.ts:151-189](file://src/db/repository.ts#L151-L189)

## Architecture Overview
The system uses Express routes for public auth endpoints and protected data endpoints. The API guard middleware validates JWTs, loads user details, checks approval status, and enforces RBAC rules per endpoint path and HTTP method.

```mermaid
sequenceDiagram
participant C as "Client"
participant S as "Server Routes<br/>server.ts"
participant G as "API Guard<br/>apiGuard.ts"
participant R as "Repository<br/>repository.ts"
participant U as "User DB<br/>schema.ts"
C->>S : POST /api/auth/login {email,password}
S->>R : getUserByEmail(email)
R->>U : SELECT users WHERE email
U-->>R : User row
R-->>S : User object
S->>S : Check approvalStatus and password
S-->>C : {success,user} or error
Note over C,S : Subsequent requests include Authorization : Bearer <token>
C->>G : GET /api/documents
G->>G : verifyAuthToken(token)
G->>R : getUserById(sub)
R->>U : SELECT users WHERE id
U-->>R : User row
R-->>G : User object
G->>G : Enforce role-based rules
G-->>C : 200 OK or 401/403
```

**Diagram sources**
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/auth/apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [src/db/repository.ts:111-189](file://src/db/repository.ts#L111-L189)
- [src/db/schema.ts:22-35](file://src/db/schema.ts#L22-L35)

## Detailed Component Analysis

### Role-Based Access Control Model
- Roles: ADMIN, RECORDS_ADMIN, RECORDS_OFFICER, DEPT_USER, AUDITOR.
- Permission groups:
  - WRITE_ROLES: ADMIN, RECORDS_ADMIN, RECORDS_OFFICER
  - CATALOG_ROLES: ADMIN, RECORDS_ADMIN
  - ADMIN_ONLY: ADMIN
  - CIRCULATION_ROLES: ADMIN, RECORDS_ADMIN, RECORDS_OFFICER
- Enforcement:
  - Admin-only endpoints: /api/users, /api/seed, /api/clear-data
  - Catalog management: /api/document-types, /api/reusable-custom-fields
  - Write operations: /api/locations, /api/documents, /api/bundles
  - Circulation: /api/checkouts/*
  - AI features: /api/ai/*
  - Auditors have read-only access; write attempts are denied.

```mermaid
flowchart TD
Start(["Request"]) --> Auth["Validate JWT"]
Auth --> |Invalid| Deny401["401 Unauthorized"]
Auth --> |Valid| LoadUser["Load User by sub"]
LoadUser --> Approved{"Approval Status APPROVED?"}
Approved --> |No| Deny403["403 Forbidden"]
Approved --> |Yes| RouteCheck{"Route + Method"}
RouteCheck --> |Admin Only| AdminOnly{"Role == ADMIN?"}
AdminOnly --> |No| Deny403
AdminOnly --> |Yes| Next["Allow"]
RouteCheck --> |Catalog| Catalog{"Role in CATALOG_ROLES?"}
Catalog --> |No| Deny403
Catalog --> |Yes| Next
RouteCheck --> |Write| Write{"Role in WRITE_ROLES?"}
Write --> |No| Deny403
Write --> |Yes| Next
RouteCheck --> |Checkouts| Circ{"Role in CIRCULATION_ROLES?"}
Circ --> |No| Deny403
Circ --> |Yes| Next
RouteCheck --> |Auditor Write| Deny403
RouteCheck --> |Other| Next
Next --> End(["Proceed to Handler"])
```

**Diagram sources**
- [src/auth/apiGuard.ts:6-97](file://src/auth/apiGuard.ts#L6-L97)

**Section sources**
- [src/types.ts:6-22](file://src/types.ts#L6-L22)
- [src/auth/apiGuard.ts:6-97](file://src/auth/apiGuard.ts#L6-L97)

### JWT-Based Authentication Flow
- Login:
  - Validates email presence
  - Retrieves user by email
  - Checks approval status (PENDING_APPROVAL or REJECTED)
  - Compares password (supports hashed or legacy plain)
  - Returns user info to client
- Token usage:
  - Clients attach Authorization: Bearer <token> to subsequent requests
  - API guard verifies token, loads user, and enforces RBAC
- Token lifecycle:
  - Signed with a secret from environment variable
  - Expiration set to 7 days
  - Verification returns payload or null on failure

```mermaid
sequenceDiagram
participant FE as "Frontend<br/>AuthPage.tsx"
participant CTX as "ArchiveContext.tsx"
participant SRV as "Server<br/>server.ts"
participant REP as "Repository<br/>repository.ts"
participant DB as "Users Table"
FE->>CTX : loginUser(email,password)
CTX->>SRV : POST /api/auth/login {email,password}
SRV->>REP : getUserByEmail(email)
REP->>DB : SELECT users WHERE email
DB-->>REP : User row
REP-->>SRV : User object
SRV->>SRV : Check approvalStatus and password
SRV-->>CTX : {success,user} or error
CTX->>FE : Update UI state and notifications
```

**Diagram sources**
- [src/components/auth/AuthPage.tsx:51-120](file://src/components/auth/AuthPage.tsx#L51-L120)
- [src/context/ArchiveContext.tsx:312-347](file://src/context/ArchiveContext.tsx#L312-L347)
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/db/repository.ts:136-149](file://src/db/repository.ts#L136-L149)

**Section sources**
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/auth/session.ts:50-65](file://src/auth/session.ts#L50-L65)
- [src/context/ArchiveContext.tsx:312-347](file://src/context/ArchiveContext.tsx#L312-L347)

### API Guard Middleware
- Public endpoints:
  - GET /api/health
  - POST /api/auth/login
  - POST /api/auth/signup
- Authorization:
  - Requires Authorization header with Bearer token
  - Verifies token and loads user
  - Ensures user account exists and is approved
  - Sanitizes user object attached to request
- Endpoint-specific rules:
  - Admin-only paths require ADMIN role
  - Catalog endpoints require catalog roles
  - Write endpoints require write roles
  - Checkouts require circulation roles
  - Auditors blocked from write operations

```mermaid
flowchart TD
A["Incoming Request"] --> B{"Path starts with /api?"}
B --> |No| N["Pass through"]
B --> |Yes| C{"Public API?"}
C --> |Yes| N
C --> |No| D["Extract Bearer token"]
D --> E{"Token present?"}
E --> |No| X["401 Unauthorized"]
E --> |Yes| F["Verify token"]
F --> G{"Valid payload?"}
G --> |No| X
G --> |Yes| H["Load user by sub"]
H --> I{"User exists and approved?"}
I --> |No| Y["401/403"]
I --> |Yes| J{"Route + Method check"}
J --> K{"Role allowed?"}
K --> |No| Y
K --> |Yes| N
```

**Diagram sources**
- [src/auth/apiGuard.ts:11-97](file://src/auth/apiGuard.ts#L11-L97)

**Section sources**
- [src/auth/apiGuard.ts:11-97](file://src/auth/apiGuard.ts#L11-L97)

### Password Hashing and Secure Storage
- Hashing:
  - Uses bcryptjs with a fixed cost factor
  - Supports detection of existing hashes vs plain text for backward compatibility
- Comparison:
  - If stored value is a hash, compare using bcrypt
  - Otherwise, perform direct comparison for legacy accounts
- Storage:
  - Users table stores password field
  - Repository ensures new users get hashed passwords unless already hashed

```mermaid
flowchart TD
Start(["Create/Update User"]) --> Check{"Password is hashed?"}
Check --> |Yes| Store["Store as-is"]
Check --> |No| Hash["Hash with bcrypt"]
Hash --> Store
Store --> End(["Persisted securely"])
```

**Diagram sources**
- [src/auth/session.ts:34-48](file://src/auth/session.ts#L34-L48)
- [src/db/repository.ts:151-189](file://src/db/repository.ts#L151-L189)

**Section sources**
- [src/auth/session.ts:34-48](file://src/auth/session.ts#L34-L48)
- [src/db/repository.ts:151-189](file://src/db/repository.ts#L151-L189)

### Secure Session Handling
- Secret management:
  - Reads SESSION_SECRET from environment
  - Falls back to a development-only default if missing or too short
- Token lifecycle:
  - Sign with secret and set expiration
  - Verify on each protected request
- Local session persistence:
  - Frontend persists current user and authentication state in localStorage
  - Restores session on app load

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant CTX as "ArchiveContext"
participant SRV as "Server"
participant SEC as "Session Utils"
FE->>CTX : Initialize
CTX->>CTX : Read localStorage
CTX->>SRV : Protected API calls with Bearer token
SRV->>SEC : verifyAuthToken(token)
SEC-->>SRV : Payload or null
SRV-->>CTX : Response based on authz
```

**Diagram sources**
- [src/auth/session.ts:23-65](file://src/auth/session.ts#L23-L65)
- [src/context/ArchiveContext.tsx:118-158](file://src/context/ArchiveContext.tsx#L118-L158)

**Section sources**
- [src/auth/session.ts:23-65](file://src/auth/session.ts#L23-L65)
- [src/context/ArchiveContext.tsx:118-158](file://src/context/ArchiveContext.tsx#L118-L158)

### User Registration Workflow and Approval Process
- Registration:
  - Frontend collects full name, email, optional password, department, title, and requested role
  - Creates user with PENDING_APPROVAL status
  - Returns success with pending message
- Approval:
  - Administrator can update approval status via dedicated endpoint
  - Login flow blocks access if status is PENDING_APPROVAL or REJECTED
- Permission assignment:
  - Role selected during registration determines future permissions once approved

```mermaid
sequenceDiagram
participant FE as "AuthPage.tsx"
participant SRV as "Server"
participant REP as "Repository"
participant DB as "Users Table"
FE->>SRV : POST /api/auth/signup {fullName,email,...}
SRV->>REP : createUser({approvalStatus : PENDING_APPROVAL})
REP->>DB : INSERT users
DB-->>REP : Created user
REP-->>SRV : User object
SRV-->>FE : {success : true,isPendingApproval : true}
```

**Diagram sources**
- [src/components/auth/AuthPage.tsx:74-120](file://src/components/auth/AuthPage.tsx#L74-L120)
- [server.ts:152-189](file://server.ts#L152-L189)
- [src/db/repository.ts:151-189](file://src/db/repository.ts#L151-L189)

**Section sources**
- [src/components/auth/AuthPage.tsx:74-120](file://src/components/auth/AuthPage.tsx#L74-L120)
- [server.ts:152-189](file://server.ts#L152-L189)
- [src/db/repository.ts:151-189](file://src/db/repository.ts#L151-L189)

### Protection Against Common Web Vulnerabilities
- SQL Injection Prevention:
  - All database queries use parameterized statements with placeholders
  - Inputs are sanitized (e.g., email trimmed and lowercased)
- XSS Protection:
  - No raw HTML rendering of user inputs observed in server responses
  - Frontend renders values safely within React components
- Input Validation:
  - Required fields validated at route level (e.g., email presence)
  - Approval status checked before granting access
- Error Handling:
  - Consistent JSON error responses with appropriate status codes
  - Graceful fallback to memory mode when database is unavailable

**Section sources**
- [src/db/repository.ts:111-189](file://src/db/repository.ts#L111-L189)
- [server.ts:104-189](file://server.ts#L104-L189)

## Dependency Analysis
Key dependencies and relationships:
- server.ts depends on repository layer for data operations and exposes routes for auth and domain features
- apiGuard.ts depends on session utilities for token verification and repository for user lookup
- session.ts depends on jsonwebtoken and bcryptjs for cryptographic operations
- repository.ts depends on db schema definitions and PostgreSQL pool
- types.ts defines shared interfaces used across layers

```mermaid
graph LR
Server["server.ts"] --> Repo["repository.ts"]
Server --> Guard["apiGuard.ts"]
Guard --> Session["session.ts"]
Repo --> Schema["schema.ts"]
Types["types.ts"] --> Guard
Types --> Repo
```

**Diagram sources**
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/auth/apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [src/auth/session.ts:23-65](file://src/auth/session.ts#L23-L65)
- [src/db/repository.ts:111-189](file://src/db/repository.ts#L111-L189)
- [src/db/schema.ts:22-35](file://src/db/schema.ts#L22-L35)
- [src/types.ts:6-22](file://src/types.ts#L6-L22)

**Section sources**
- [server.ts:104-189](file://server.ts#L104-L189)
- [src/auth/apiGuard.ts:27-97](file://src/auth/apiGuard.ts#L27-L97)
- [src/auth/session.ts:23-65](file://src/auth/session.ts#L23-L65)
- [src/db/repository.ts:111-189](file://src/db/repository.ts#L111-L189)
- [src/db/schema.ts:22-35](file://src/db/schema.ts#L22-L35)
- [src/types.ts:6-22](file://src/types.ts#L6-L22)

## Performance Considerations
- Token verification is lightweight and performed per request; ensure secrets are configured securely to avoid unnecessary retries.
- Parameterized queries reduce overhead and improve safety without significant performance penalties.
- Memory fallback mode allows continued operation when database is unavailable, but should be used only for development or temporary resilience.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Authentication required:
  - Ensure Authorization header includes a valid Bearer token
  - Verify token has not expired
- Session expired or invalid:
  - Re-authenticate via login endpoint
- Account no longer exists:
  - Confirm user was not deleted; re-register if necessary
- Account is not approved for access:
  - Administrator must approve pending accounts before login succeeds
- Incorrect password provided:
  - Reset credentials or confirm password matches stored hash

**Section sources**
- [src/auth/apiGuard.ts:31-48](file://src/auth/apiGuard.ts#L31-L48)
- [server.ts:104-189](file://server.ts#L104-L189)

## Conclusion
ArchiveHub implements a robust authentication and authorization framework centered around JWT tokens, bcrypt password hashing, and strict RBAC enforcement via middleware. The approval workflow ensures controlled access for new users, while parameterized queries and input validation protect against common vulnerabilities. Extending roles and adding custom guards can be achieved by updating role sets and route checks in the API guard.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Implementing Custom Authentication Guards
- Add new role sets and route checks in the API guard to enforce additional permissions
- Extend role types and UI descriptions consistently across frontend and backend
- Use the same pattern for sanitizing user objects and verifying tokens

**Section sources**
- [src/auth/apiGuard.ts:6-97](file://src/auth/apiGuard.ts#L6-L97)
- [src/types.ts:6-22](file://src/types.ts#L6-L22)

### Extending the Role System
- Define new roles in the type definition
- Update permission groups and route checks accordingly
- Reflect changes in UI role selection and descriptions

**Section sources**
- [src/types.ts:6-22](file://src/types.ts#L6-L22)
- [src/components/auth/AuthPage.tsx:122-128](file://src/components/auth/AuthPage.tsx#L122-L128)