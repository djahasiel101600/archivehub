# Digital Copy Management

<cite>
**Referenced Files in This Document**
- [digitalCopies.ts](file://src/files/digitalCopies.ts)
- [schema.ts](file://src/db/schema.ts)
- [repository.ts](file://src/db/repository.ts)
- [server.ts](file://server.ts)
- [ArchiveContext.tsx](file://src/context/ArchiveContext.tsx)
- [DocumentDetailPage.tsx](file://src/pages/DocumentDetailPage.tsx)
- [EditDocumentModal.tsx](file://src/components/documents/EditDocumentModal.tsx)
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
10. [Appendices](#appendices)

## Introduction
This document explains how ArchiveHub manages digital copies attached to physical documents. It covers the integration between physical records and their digital surrogates, upload handling, file naming and validation, metadata storage, versioning, viewing and downloading workflows, security considerations for sensitive content, storage optimization strategies, backup procedures, and common scenarios such as scanning, updating versions, and managing large uploads.

## Project Structure
The digital copy feature spans several layers:
- Frontend UI for editing document metadata and attaching digital copies
- Context layer that updates document state and persists changes via API
- Server routes that handle document updates
- Database schema and repository logic that store digital copy metadata
- File utilities that safely save and resolve digital files on disk

```mermaid
graph TB
subgraph "Frontend"
A["EditDocumentModal.tsx"]
B["DocumentDetailPage.tsx"]
C["ArchiveContext.tsx"]
end
subgraph "Server"
D["server.ts"]
end
subgraph "Data Layer"
E["repository.ts"]
F["schema.ts"]
end
subgraph "Filesystem"
G["digitalCopies.ts"]
end
A --> C
B --> C
C --> D
D --> E
E --> F
C --> G
D --> G
```

**Diagram sources**
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [DocumentDetailPage.tsx:398-422](file://src/pages/DocumentDetailPage.tsx#L398-L422)
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [server.ts:318-326](file://server.ts#L318-L326)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [digitalCopies.ts:16-41](file://src/files/digitalCopies.ts#L16-L41)

**Section sources**
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [DocumentDetailPage.tsx:398-422](file://src/pages/DocumentDetailPage.tsx#L398-L422)
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [server.ts:318-326](file://server.ts#L318-L326)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [digitalCopies.ts:16-41](file://src/files/digitalCopies.ts#L16-L41)

## Core Components
- Digital copy metadata model: The document entity includes fields to track whether a digital copy exists, its filename, size label, MIME type, and version number. These are persisted in the database and surfaced in the UI.
- File utilities: Provide safe filename generation, base64 decoding, saving files under a per-document directory, and resolving absolute paths with path traversal protection.
- Edit modal: Allows users to attach or update a digital surrogate by toggling an option, setting a filename, version, and type; it also auto-generates a default filename when none is provided.
- Detail page: Displays attached digital copy information and provides a download action placeholder.
- Context and server: Persist digital copy metadata updates through the API to the database repository.

**Section sources**
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [digitalCopies.ts:6-46](file://src/files/digitalCopies.ts#L6-L46)
- [EditDocumentModal.tsx:72-105](file://src/components/documents/EditDocumentModal.tsx#L72-L105)
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [DocumentDetailPage.tsx:398-422](file://src/pages/DocumentDetailPage.tsx#L398-L422)
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [server.ts:318-326](file://server.ts#L318-L326)

## Architecture Overview
Digital copy management integrates frontend editing, context-driven persistence, server-side routing, database schema, and filesystem operations.

```mermaid
sequenceDiagram
participant U as "User"
participant M as "EditDocumentModal.tsx"
participant C as "ArchiveContext.tsx"
participant S as "server.ts"
participant R as "repository.ts"
participant DB as "schema.ts (documents)"
participant FS as "digitalCopies.ts"
U->>M : Toggle "Attach Digital Copy", set name/version/type
M->>C : updateDocument(id, { hasDigitalCopy, digitalFileName, digitalFileVersion, digitalFileType })
C->>S : PUT /api/documents/ : id { updates, user }
S->>R : updateDocument(id, updates, user)
R->>DB : UPDATE documents SET has_digital_copy, digital_file_name, digital_file_size, digital_file_type, digital_file_version
Note over R,DB : Metadata persisted to DB
U->>M : Save
M-->>U : Success feedback
U->>B : Open DocumentDetailPage
B->>B : Render attached digital copy info
B->>FS : Resolve file path for download (placeholder)
FS-->>B : Absolute path if valid
```

**Diagram sources**
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [server.ts:318-326](file://server.ts#L318-L326)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [digitalCopies.ts:33-41](file://src/files/digitalCopies.ts#L33-L41)
- [DocumentDetailPage.tsx:398-422](file://src/pages/DocumentDetailPage.tsx#L398-L422)

## Detailed Component Analysis

### Digital Copy Metadata Model
- Fields tracked per document:
  - Flag indicating presence of a digital copy
  - Filename, size label, MIME type, and version number
- These fields are part of the documents table and mapped into the application’s document type.

Key behaviors:
- When creating or updating a document, these fields can be set or modified.
- Repository code writes these fields to the database during create/update operations.

**Section sources**
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [repository.ts:577-599](file://src/db/repository.ts#L577-L599)
- [repository.ts:685-689](file://src/db/repository.ts#L685-L689)
- [types.ts:135-183](file://src/types.ts#L135-L183)

### File Utilities: Safe Upload and Resolution
- Safe filename generation sanitizes input and enforces length limits to prevent path issues.
- Base64 payload decoder supports data URLs commonly used in browser-based uploads.
- Saving function creates a per-document directory under a configured root and writes the buffer to disk, returning relative path, filename, and formatted size label.
- Path resolution validates that requested files reside within the allowed upload root and exist on disk before returning an absolute path.

Operational notes:
- Directory creation is recursive to ensure isolation per document.
- Path traversal protection prevents accessing files outside the upload root.

**Section sources**
- [digitalCopies.ts:6-46](file://src/files/digitalCopies.ts#L6-L46)

### Edit Modal: Attaching and Updating Digital Copies
- Users can toggle attachment of a digital surrogate.
- When enabled, they can specify:
  - File name (auto-generated from title if omitted)
  - Version number (defaults to 1)
  - File type (defaults to PDF MIME type)
- On submit, the modal sends updates to the context which persists them via API.

Behavioral highlights:
- Default filename generation ensures a consistent naming pattern based on the document title.
- Version field allows incremental updates to reflect new scans or revisions.

**Section sources**
- [EditDocumentModal.tsx:72-105](file://src/components/documents/EditDocumentModal.tsx#L72-L105)
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [EditDocumentModal.tsx:559-604](file://src/components/documents/EditDocumentModal.tsx#L559-L604)

### Detail Page: Viewing and Downloading Digital Copies
- If a document has a digital copy, the detail page displays:
  - Attached filename
  - Type and size label
  - Version number
- Provides a download button that simulates initiating a download.

Integration points:
- Display relies on document metadata fields populated by the context and persisted to the database.
- Download flow can be extended to use file resolution utilities to serve the actual file securely.

**Section sources**
- [DocumentDetailPage.tsx:398-422](file://src/pages/DocumentDetailPage.tsx#L398-L422)

### Context and Server: Persistence of Digital Copy Metadata
- Context updateDocument method updates local state, logs an audit entry, and calls the server API to persist changes.
- Server route delegates to repository updateDocument, which constructs dynamic SQL to update only changed fields, including digital copy metadata.

Flow characteristics:
- Immediate UI feedback via optimistic updates in context.
- Robust persistence via repository with conditional field updates.

**Section sources**
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [server.ts:318-326](file://server.ts#L318-L326)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)

### Data Flow: From Upload to Storage
```mermaid
flowchart TD
Start(["Upload Entry"]) --> Decode["Decode Base64 Payload"]
Decode --> Sanitize["Sanitize Filename"]
Sanitize --> CreateDir["Create Per-Document Directory"]
CreateDir --> WriteFile["Write Buffer to Disk"]
WriteFile --> ReturnMeta["Return Relative Path, Filename, Size Label"]
ReturnMeta --> UpdateDoc["Update Document Metadata via API"]
UpdateDoc --> Persist["Persist to Database"]
Persist --> End(["Complete"])
```

**Diagram sources**
- [digitalCopies.ts:43-46](file://src/files/digitalCopies.ts#L43-L46)
- [digitalCopies.ts:16-31](file://src/files/digitalCopies.ts#L16-L31)
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)

## Dependency Analysis
- EditDocumentModal depends on ArchiveContext to persist metadata updates.
- ArchiveContext depends on server routes for persistence and on repository for database operations.
- Repository depends on schema definitions for column mapping and SQL construction.
- File utilities are independent but consumed by upload/download flows to manage filesystem interactions.

```mermaid
graph LR
M["EditDocumentModal.tsx"] --> Ctx["ArchiveContext.tsx"]
Ctx --> Srv["server.ts"]
Srv --> Repo["repository.ts"]
Repo --> Sch["schema.ts"]
Ctx --> FS["digitalCopies.ts"]
Srv --> FS
```

**Diagram sources**
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [server.ts:318-326](file://server.ts#L318-L326)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [digitalCopies.ts:16-46](file://src/files/digitalCopies.ts#L16-L46)

**Section sources**
- [EditDocumentModal.tsx:147-197](file://src/components/documents/EditDocumentModal.tsx#L147-L197)
- [ArchiveContext.tsx:779-811](file://src/context/ArchiveContext.tsx#L779-L811)
- [server.ts:318-326](file://server.ts#L318-L326)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)
- [schema.ts:67-116](file://src/db/schema.ts#L67-L116)
- [digitalCopies.ts:16-46](file://src/files/digitalCopies.ts#L16-L46)

## Performance Considerations
- Avoid storing large files in memory: Use streaming where possible for very large uploads.
- Limit request body size: The server configures a JSON limit; consider separate endpoints for binary uploads to avoid payload size constraints.
- Efficient metadata updates: Repository updates only changed fields to minimize write overhead.
- File system I/O: Ensure adequate disk space and consider asynchronous writes for high-throughput environments.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Upload fails due to invalid filename: Ensure filenames are sanitized; the utility replaces unsafe characters and truncates excessively long names.
- Path traversal attempts blocked: The resolver checks that resolved paths remain within the configured upload root; verify correct relative paths.
- Missing file on download: Confirm that the file was saved successfully and that the stored relative path matches the actual location.
- Metadata not persisted: Verify that the updateDocument call includes the relevant fields and that the server route forwards updates to the repository.

**Section sources**
- [digitalCopies.ts:6-46](file://src/files/digitalCopies.ts#L6-L46)
- [repository.ts:635-700](file://src/db/repository.ts#L635-L700)
- [server.ts:318-326](file://server.ts#L318-L326)

## Conclusion
ArchiveHub’s digital copy management integrates frontend editing, context-driven persistence, server routing, database schema, and secure filesystem operations. It supports versioned attachments, safe file handling, and clear metadata tracking. For production deployments, extend the download endpoint to serve files securely, implement robust access controls, and adopt scalable storage and backup strategies.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Security Considerations for Sensitive Documents
- Access control: Restrict who can view or download digital copies based on roles and confidentiality levels.
- Path validation: Always validate and normalize paths to prevent traversal attacks.
- Content validation: Validate MIME types and file signatures to reject unexpected formats.
- Encryption at rest: Consider encrypting stored files for highly sensitive content.
- Audit logging: Log all access and modifications to digital assets.

[No sources needed since this section provides general guidance]

### Storage Optimization Strategies
- Deduplicate identical files using content hashing to avoid redundant storage.
- Compress scanned images where appropriate to reduce size while preserving readability.
- Implement lifecycle policies to archive or purge outdated versions.
- Use efficient storage backends (e.g., object storage) for scalability.

[No sources needed since this section provides general guidance]

### Backup Procedures for Digital Assets
- Regularly back up the upload directory structure to a secure, offsite location.
- Include database backups that contain digital copy metadata.
- Test restoration processes periodically to ensure recoverability.
- Maintain versioned backups to support rollback after accidental deletions.

[No sources needed since this section provides general guidance]

### Common Scenarios

#### Scanning Physical Documents
- Steps:
  - Scan the physical document to a digital format (e.g., PDF).
  - In EditDocumentModal, enable “Attach Digitized Electronic Surrogate Copy”.
  - Optionally set a custom filename, version, and type.
  - Save to persist metadata; integrate with a backend upload handler to write the file using the file utilities.

**Section sources**
- [EditDocumentModal.tsx:559-604](file://src/components/documents/EditDocumentModal.tsx#L559-L604)
- [digitalCopies.ts:16-31](file://src/files/digitalCopies.ts#L16-L31)

#### Updating Versions
- Steps:
  - Open the document’s edit modal.
  - Increment the version number for the digital copy.
  - Save to update metadata; replace the underlying file on disk if necessary.

**Section sources**
- [EditDocumentModal.tsx:574-604](file://src/components/documents/EditDocumentModal.tsx#L574-L604)
- [repository.ts:685-689](file://src/db/repository.ts#L685-L689)

#### Managing Large File Uploads
- Recommendations:
  - Use chunked uploads to improve reliability and progress reporting.
  - Validate file size and type before processing.
  - Stream data to disk rather than buffering entirely in memory.
  - Monitor disk usage and enforce quotas.

[No sources needed since this section provides general guidance]