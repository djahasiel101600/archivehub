---
kind: design
name: Batch QR relocation via dedicated two-step modal and server-side batch endpoint
source: session
category: adr
---

# Batch QR relocation via dedicated two-step modal and server-side batch endpoint

_Source: coding plans from commit period d27445f → 14d1799 — records intent at planning time; the implementation may lag or differ._

**Status:** accepted

## Context
Relocating documents one-by-one on a phone is impractical when moving 20+ items; the existing single-scan scanner and per-document move flow do not support accumulating multiple scans before committing.

## Decision drivers
- mobile ergonomics for bulk operations
- reuse existing camera/QR infrastructure
- auditability of each individual move
- atomicity of the batch operation

## Considered options
- **Extend CameraQRScannerModal to accumulate scans** _(rejected)_ — pros: shares UI code with single-scan path; cons: mixes single and batch concerns in one component; harder to keep single-scan UX unchanged
- **Client-side loop calling existing moveDocument per document** _(rejected)_ — pros: simplest backend change; cons: no transactional guarantee, no single notification, poor error handling at scale
- **New BatchRelocateModal + POST /api/documents/batch-move** — pros: isolates batch workflow, reuses Html5QrcodeScanner config, keeps single-scan untouched, supports DB transaction and single audit trail; cons: new component and endpoint to maintain

## Decision
Introduce a standalone `BatchRelocateModal` with a Scan Phase (continuous QR scanning into an in-memory list) and a Confirm Phase (destination picker + optional bundling), backed by a new `POST /api/documents/batch-move` endpoint that calls `repo.moveDocument()` per ID inside a single PostgreSQL transaction and emits one consolidated notification.

## Consequences
Single-scan scanner remains unchanged; batch operations are discoverable from Header and MobileBottomNav. Each relocated document still gets its own RELOCATION movement record and audit entry, preserving traceability. Transactional atomicity means either all moves succeed or none do, but rollback requires undoing any partial side effects (e.g., bundle creation) if the DB layer does not fully roll back.