---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### Bundle / Dossier
- Definition：A logical grouping of multiple physical archive records into a single unit for joint storage, retrieval, and tracking. A bundle has its own unique number (e.g. BNDL-YYYY-NNNN), title, description, department, location path, status, QR code, barcode, and an array of member document IDs. Documents can also carry denormalized `bundle_id`, `bundle_number`, and `bundle_title` columns pointing back to their parent bundle.
- Aliases：bundle、dossier、group

### Bundle Number
- Definition：A human-readable, unique identifier for a bundle/dossier, generated as `BNDL-YYYY-NNNN` where YYYY is the current year and NNNN is a random four-digit sequence. It must be unique across all bundles.
- Aliases：bundle_number、BNDL-

### Department
- Definition：An organizational unit within the archive system that owns documents and bundles. Each department has a code, name, head name, and a running count of associated documents.
- Aliases：dept、department_id

### Location Path
- Definition：A hierarchical string representation of a physical archive location built from its ancestors (building → floor → room → cabinet → rack → shelf → box → folder). Used to display where a document or bundle is stored.
- Aliases：location_path、path

### Retention Policy
- Definition：A rule tied to a document type that specifies how long records must be kept (`retention_years`) and what method is used to dispose of them after the retention period expires.
- Aliases：retention_policy、retention_years、disposal_method

### Disposal Record
- Definition：An immutable audit entry created when a document is destroyed under a retention policy, capturing the certificate number, witness name, disposal date, and method.
- Aliases：disposal_record、certificate_number

### Checkout
- Definition：A temporary loan of a physical document from its home location to another user, tracked with requester/approver/holder identities, due date, purpose, and condition notes. Statuses include REQUESTED, CHECKED_OUT, RETURNED.
- Aliases：checkout、check_out、loan

### Movement
- Definition：A record of any change in a document's physical location, capturing from/to location paths, movement type, authorizing and performing users, reason, and timestamp.
- Aliases：movement、move_log

### Audit Log
- Definition：A tamper-evident log of every significant action performed in the system, recording who did what to which entity, with before/after values captured as text snapshots.
- Aliases：audit_log、audit_logs

### Reusable Custom Fields
- Definition：A shared definition of typed form fields (name, label, type, options, placeholder, required flag, category) that can be reused across document types to capture domain-specific metadata beyond the fixed schema.
- Aliases：custom_field_definition、reusable_custom_fields
