# ArchiveHub — Assessment Fix Implementation ToDo List

## Phase 1 — Immediate fixes (stop the bleeding)

### C-06 — Fix dateStr timezone formatting (DONE)
- [x] repository.ts `dateStr()` — use local getters instead of toISOString()

### M-23 — Restore `-translate-y-1/2` CSS class (9 spots) (DONE)
- [x] DocumentsPage.tsx:571
- [x] DocumentTypeCombobox.tsx:177
- [x] LocationsPage.tsx:395
- [x] BundlesPage.tsx:270, 282
- [x] Header.tsx:146, 160, 404, 419

### C-03 — Remove departmentId/departmentName from self-profile whitelist (DONE)
- [x] server.ts PUT /api/users/:id — remove departmentId/departmentName from `allowed`
- [x] ProfileModal.tsx — remove Department dropdown from self-profile (admin-controlled)

### H-01 — Remove persona switcher from production (DONE)
- [x] Header.tsx — remove "Switch Active Persona" dropdown + availableUsers dependency

### M-12d — Remove demo "sample code" buttons from scanner (DONE)
- [x] CameraQRScannerModal.tsx — remove handleSampleScan + sample buttons

### H-03 — Server-side whitelist for bulk-update fields (DONE)
- [x] repository.ts bulkUpdateDocuments — whitelist allowed fields
- [x] server.ts bulk-update route — whitelist

### H-05 — Block delete while any active checkout exists (REQUESTED/APPROVED/CHECKED_OUT/OVERDUE) (DONE)
- [x] repository.ts deleteDocument — extend guard beyond CHECKED_OUT
- [x] server.ts delete route — already relies on repo guard

### H-10 — Await delete result; truthful feedback (DocumentDetailPage) (DONE)
- [x] DocumentDetailPage.tsx — await deleteDocument, branch on result

### H-06 — BatchRelocate honest error/partial-failure states (DONE)
- [x] BatchRelocateModal.tsx — distinct error state, per-item outcomes
- [x] server.ts batch-move — report per-item errors instead of swallowing
- [x] repository.ts batchMoveDocuments — returns { moved, errors }
- [x] ArchiveContext.tsx batchMoveDocuments — returns result with errors

### C-01 — Release-loan dialog with required staging location + sequential awaits + APPROVED-state recovery (DONE)
- [x] CheckoutsPage.tsx — release-loan modal, sequential awaits, APPROVED recovery actions
- [x] ArchiveContext.tsx — processCheckoutDispatch requires tempLocationId

---

## Phase 2 — High-impact usability

### C-05 + M-08 — Admin provisioning + role edit; honest public signup
- [ ] server.ts — add admin-only POST /api/users/create (honors chosen role)
- [ ] server.ts — signup: restrict to DEPT_USER/AUDITOR only (already done)
- [ ] SettingsPage.tsx — role edit action in user table; admin create-user form
- [ ] AuthPage.tsx — signup offers only DEPT_USER/AUDITOR

### H-02 — Role-driven navigation/action visibility mirroring apiGuard
- [ ] Sidebar.tsx — gate nav items by role
- [ ] SettingsPage.tsx — add role check
- [ ] Detail/circulation buttons — gate by role

### C-04 + M-02 — Live overdue derivation + due-date validation + worklist
- [ ] repository.ts getCheckouts — derive OVERDUE dynamically (CHECKED_OUT && dueDate < today)
- [ ] server.ts requestCheckout — validate dueDate >= today
- [ ] CheckoutsPage/Dashboard — overdue worklist

### H-11 — Loading states, error banners with retry, refetch-on-activation
- [ ] ArchiveContext — loading skeletons, error banners

### M-01 — Human-readable validation errors; proper 4xx mapping
- [ ] server.ts/repository.ts — map constraint violations to friendly messages

### H-09 + M-06 — Admin password reset; delete confirmations; last-admin guard
- [ ] server.ts — admin password reset endpoint
- [ ] SettingsPage.tsx — confirm delete user + last-admin guard

### M-07 — Unified password policy + hints (6 vs 8)
- [ ] ProfileModal.tsx — change min 6 to min 8
- [ ] AuthPage.tsx — add password hints

### A-01/A-02 — Keyboard-accessible location tree + consistent combobox semantics
- [ ] LocationsPage.tsx — tree nodes as buttons with keyboard handling
- [ ] DocumentTypeCombobox.tsx — full ARIA listbox semantics

---

## Phase 3 — Operational workflow improvements

### C-02 — FK-safe transactional restore with pre-flight
- [ ] repository.ts importAllData — FK-safe delete order in one transaction

### H-07 + H-08 + H-12 — Real retention review queues + disposal chain
- [ ] RetentionPage.tsx — past expiry queue, real schedule review, disposal chain

### M-16 + L-06 — Persistent server-stored notifications
- [ ] notifications table + API

### M-03/M-04/M-05/M-09 — Lifecycle & hierarchy guards
- [ ] batch-move exclude CHECKED_OUT
- [ ] location type-order + acyclicity
- [ ] document-type reference guard
- [ ] SEALED bundle enforcement

---

## Notes
- Work sequentially through Phase 1 first.
- After each fix, run `npx tsc --noEmit` to verify types compile.
- The server runs on port 3031; Vite dev via `npm run dev`.