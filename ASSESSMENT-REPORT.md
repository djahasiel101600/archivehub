# ArchiveHub — Autonomous UI/UX, Usability & Real-World Operational Assessment

**Assessment date:** 2026-11-23
**Scope:** Entire application (all pages, modals, server API, database layer, auth, scanner, files) + focused end-to-end throughput review of the **registration → filing → retrieval** operations at a 300-documents/day workload (Section H)
**Method:** Full code audit + runtime reproduction in an isolated sandbox + browser verification
**Verdict (summary):** **Requires significant improvements before daily operational use.** The cataloguing/search/scan foundation is genuinely good, but the circulation release step is broken, staff accounts cannot be provisioned, overdue tracking is dead, backup restore fails, and a confidentiality escalation exists. Details in Section G.

---

## Methodology, Environment & Limitations

### How the assessment was performed
1. **Structure mapping** — all 10 pages, 20+ modals/components, ~70 API routes, role model, DB schema/migrations.
2. **Workflow tracing** — capture → filing → checkout request → approval → release → return; bundle fill/relocate/dissolve; retention/disposal; user lifecycle; backup/restore.
3. **Module audit** — every page and modal read in full; validation, feedback, error handling, role gating checked.
4. **Runtime reproduction** — the live database belongs to the owner and its only account's password is unknown, so **no testing was done against production data**. Instead an isolated sandbox was built:
   - Disposable PostgreSQL 16 container (`archivehub-audit-db`, port 5433, now **stopped**, kept for reproducibility).
   - A throwaway copy of `server.ts` (`audit-sandbox/server.ts`, port 3032) — the only changes were the port, import paths, and Vite root. **Application source code was not modified.**
   - All test data prefixed `AUDIT-TEST`. Scripts and raw results: `audit-sandbox/repro*.mjs`, `repro*-results.json`, `repro*-console.txt`.
5. **Browser verification** — two automated browser sessions against the sandbox (login, circulation, persona switch, retention, settings, registration form, detail page, mobile layout). Screenshots: `audit-sandbox/shot-*.png`.

### Verification legend
- **[R]** Reproduced at runtime (API and/or browser) — confirmed defect.
- **[C]** Code-verified end-to-end (exact defect path traced in source) — not runtime-reproduced, but the mechanism is unambiguous.
- **[P]** Potential risk / improvement opportunity — not a confirmed defect.

### Limitations (documented, not guessed)
- **Production data untouched.** The live Supabase DB contains one real ADMIN account with an unknown password; it was only inspected read-only (user count/roles) to plan the sandbox. Findings therefore describe the shipped code, which is what production runs.
- **Camera/GPS hardware** could not be exercised headlessly; scanner flows were verified via code + manual key-in paths.
- **AI bundle suggestion** could not be functionally tested (placeholder `GEMINI_API_KEY`); its failure mode was code-verified.
- **Mobile testing** used viewport emulation (390px); the browser harness could not resize natively. One artifact in the mobile screenshot is emulation-related, not app breakage.
- **Email/SMS delivery** does not exist in the system; "notification" claims were evaluated against the in-app mechanism only.
- The sandbox server and DB container were stopped after testing. The owner's running instance (port 3031) was verified healthy and untouched.

### Disclosure
Finding **M-23** (broken `-tranzinc-y-1/2` CSS class in 9 places) is a regression introduced by the earlier color-palette alignment pass performed in this workspace. It is reported here like any other finding and was **not** fixed, per the no-code-changes audit rule.

---

## A. Application Overview

### Purpose
ArchiveHub ("PDAMS") manages **physical documents and their digital surrogates** for an organization: registration/cataloguing, hierarchical storage locations, QR/barcode tagging, scan-driven filing and relocation, borrowing (checkout) circulation, retention schedules, audit trails, and role-based access.

### Discovered modules
| Module | Purpose | Primary users |
|---|---|---|
| Dashboard | KPIs, "needs attention" worklist, retention snapshot, recent activity | All staff |
| Documents (catalogue) | Search/filter/paginate records, bulk select, bulk update, register, export | Records staff, dept users (search) |
| Document capture/registration | Full intake form: dept, type, home location, confidentiality, condition, photos, digital copy | Records officers |
| Document detail | Metadata, movement history, checkout ledger, audit trail; edit/relocate/delete/print QR | Records staff |
| Bundles | Group documents into boxes/folders; scan-fill, dissolve, QR tags | Records officers |
| Locations | Hierarchical storage tree (building→floor→room→cabinet→shelf→box→folder), GPS, QR | Records admins |
| Circulation Desk | Request → approve → release → return lifecycle; condition in/out | Officers + dept users |
| Scanner | Camera QR/barcode + manual key-in; lookup, fill-bundle, batch-relocate flows | Officers (mobile) |
| Retention | Per-type statutory schedules; upcoming-expiry review list | Records admins |
| Audit Log | Immutable-style trail of all operations | Admins, auditors |
| Settings | Users & approval, departments, document types, custom fields, import/export, reseed, danger zone | Admins |
| Auth | Sign-in, public sign-up with admin approval, profile modal | Everyone |

### Role model
ADMIN, RECORDS_ADMIN, RECORDS_OFFICER (write/catalog/circulation tiers), DEPT_USER (search + borrow requests), AUDITOR (read-only oversight). Server-side enforcement (`apiGuard`) is well structured; **UI-side enforcement is largely absent** (see H-02).

### Core relationships
Documents belong to a department + document type (which carries retention years) and have a home location and current location in the hierarchy. Checkouts move documents through REQUESTED → APPROVED → CHECKED_OUT → RETURNED with movement + audit records. Bundles aggregate documents and sync both sides transactionally. Retention expiry is computed **client-side** at registration from the type's retention years.

---

## B. Overall Assessment

| Dimension | Rating | Notes |
|---|---|---|
| General usability | **Fair** | Clean visual language, good catalogue UX; but broken primary actions and misleading feedback undermine trust |
| Operational practicality | **Poor–Fair** | Cannot provision staff, cannot release loans, cannot track overdue, cannot restore backups — four day-one operational blockers |
| UI consistency | **Good** | Consistent teal/zinc design system, cards, badges, modals; a few disconnected buttons and one CSS regression |
| Functional usability | **Fair** | Many flows work well (scan-fill, return, bundles); several flagship actions fail or fake success |
| Data integrity & security | **Mixed** | Strong server guards, transactions, hashing, rate limits; but a confidentiality escalation, unfiltered bulk-update API, and a universal date-shift bug |

### Major strengths (verified)
- **Transactional circulation core** — checkout request/approve/return use `BEGIN…FOR UPDATE…COMMIT` with status guards; race-safe auto document numbering; atomic QR claim.
- **Server-side security baseline** — JWT in HttpOnly/SameSite=Strict cookie, bcrypt, credential rate limiting (10/15 min, observed working), CSRF origin check, role guard on every mutation, confidentiality filtering applied server-side on list/detail/lookup.
- **File-upload hardening** — path-traversal guards, filename sanitization, MIME whitelist, 40 MB limit for digital copies and photos.
- **Referential delete guards** — locations and departments cannot be deleted while in use, with explanatory messages; import/reseed confirmations explicitly warn about replacement.
- **Scan-fill bundle modal** — duplicate detection, cross-bundle warnings, remote lookup fallback, audio feedback, explicit "Close Without Saving".
- **Dashboard worklist** — actionable pending requests/approvals, clickable KPIs, deep links.
- **Documents catalogue** — pagination, filters, bulk bar, CSV export with formula-injection escaping.
- **Seed safety** — bootstrap only on empty DB; existing data never modified.

### Major weaknesses
1. The single most important circulation button ("Approve & Release") **always fails** and strands records in a state with no recovery UI (C-01).
2. **Records staff cannot be created** — every privileged role request is silently downgraded to DEPT_USER and no role-edit exists (C-05).
3. **Overdue is fictional** — the status is never written; a 6-year-overdue loan displays "All within due dates" (C-04).
4. **Backup restore fails on any non-empty database** (C-02).
5. **Any user can read another department's CONFIDENTIAL records** by changing their own department in the profile (C-03).
6. **Every date reads back one day earlier** than entered (C-06).
7. Demo-era features shipped to production: persona switcher, sample-data buttons, fake digital surrogates, fake "Schedule review" (H-01, H-04, H-07, M-12).
8. **Intake is not built for volume:** every registration closes the form, tagging is a disconnected multi-screen chore, photo intake forces a two-pass draft workflow, and each save re-downloads the whole catalogue — at 300 documents/day these compound into hours of avoidable desk time (Section H, T-01…T-13).

---

## C. Detailed Findings

Priority: **Critical** = blocks daily operations or breaches confidentiality/data integrity; **High** = serious operational or trust impact; **Medium** = friction, edge-case failure, or risk; **Low** = polish.

### CRITICAL

#### C-01 — "Approve & Release" always fails; checkout stuck in APPROVED limbo
- **Module:** Circulation Desk (`CheckoutsPage.tsx` L203–206, `ArchiveContext.processCheckoutDispatch`, `server.ts` dispatch route, `documents.current_location_id NOT NULL`)
- **Problem:** The button fires `approveCheckout(id)` and `processCheckoutDispatch(id)` without awaiting and **without any temporary location**. Dispatch writes `current_location_id = NULL`, violating the NOT NULL constraint → HTTP 500 *after* approval already committed.
- **Reproduction [R]:** Sandbox API: approve → 200, dispatch `{}` → 500 `null value in column "current_location_id"…`. Browser: clicked "Approve & Release"; notifications showed success ("…approved.") **and** the raw SQL error; row became "Approved" with **zero action buttons**; it appears only under "All" — not Pending, Active, or Overdue (`CheckoutsPage` has no APPROVED branch at all).
- **Why it matters:** This is *the* daily circulation action. Every loan attempt strands a record that no officer can advance or cancel through the UI; the physical document leaves the shelf with no system trail. Recovery is only possible by direct API call with a location (verified: re-dispatch with `tempLocationId` → 200, CHECKED_OUT).
- **Recommendation:** Replace the two fire-and-forget calls with one modal: collect the temporary/staging location (required), then `await approve` → `await dispatch` sequentially; add an APPROVED-state action ("Release to borrower" / "Cancel approval") as a safety net.
- **Expected result:** Loans complete reliably; no orphaned states; officers always have a next step.
- **Priority:** Critical · **Classification:** Functionality / Workflow

#### C-02 — Backup restore (import) fails on any non-empty database
- **Module:** Settings → Database & backups (`repository.importAllData`, `/api/import`)
- **Problem:** Import deletes departments before documents; `fk_documents_department` is RESTRICT, so the delete aborts the whole restore.
- **Reproduction [R]:** Export → re-import into the same populated sandbox DB → 500 `update or delete on table "departments" violates foreign key constraint "fk_documents_department"`. (With zero documents it succeeds — masking the bug in demos.)
- **Why it matters:** Backups are the disaster-recovery path for an archive of record. A restore that only works on an empty DB is useless after any real incident, and the UI presents import as a working feature with a confident REPLACE warning.
- **Recommendation:** Delete in FK-safe order (checkouts/movements/disposals → documents → bundles → locations → types → departments → users) inside one transaction, or stage-and-swap; add a restore dry-run/preview.
- **Expected result:** Restores succeed on live databases; backups become trustworthy.
- **Priority:** Critical · **Classification:** Functionality / Operational Capability

#### C-03 — Self-service department change grants access to other departments' CONFIDENTIAL records
- **Module:** Profile modal → `PUT /api/users/:id` (`apiGuard` self-update exemption L88–90; `canViewDocument` CONFIDENTIAL rule)
- **Problem:** The self-profile update whitelist includes `departmentId`. CONFIDENTIAL visibility = records staff + auditors + *owning department*. A user can simply switch their own department to the target's.
- **Reproduction [R]:** Fresh DEPT_USER in Dept A: GET confidential Dept B doc → **403**, absent from list. PUT own profile `{departmentId: DeptB}` → 200. Same GET → **200**, doc now in list. No admin involvement, no audit flag.
- **Why it matters:** Confidentiality is a core archive guarantee (personnel, legal, medical records). Any authenticated user can silently self-grant access; the audit trail records a routine profile edit, not an access change.
- **Recommendation:** Remove `departmentId`/`departmentName` from the self-update whitelist; department changes become an admin action with audit entry. Optionally notify admins of department-change requests.
- **Expected result:** CONFIDENTIAL boundary holds; access changes are accountable.
- **Priority:** Critical · **Classification:** Functionality (access control)

#### C-04 — Overdue tracking is entirely non-functional
- **Module:** Circulation, Dashboard, Header/Sidebar/MobileBottomNav badges
- **Problem:** `OVERDUE` exists in the type, filters, tabs, badges and KPIs, but **no code ever writes it** (exhaustive search: 17 readers, 0 writers) and no due-date comparison runs anywhere.
- **Reproduction [R]:** Checkout with due date 2020-01-01 dispatched successfully; status stays CHECKED_OUT forever. Browser: Overdue tab = **0** with empty state; Dashboard says "**All within due dates**" while the 6-year-overdue loan sits in Active.
- **Why it matters:** Chasing overdue loans is a primary daily duty of circulation staff and a compliance requirement for archives. The system actively *misinforms* ("all within due dates") instead of merely omitting the feature.
- **Recommendation:** Compute overdue dynamically (`status = CHECKED_OUT && dueDate < today`) for tabs/badges/KPIs immediately (no schema change), and/or a nightly job that flips status + writes an audit entry. Validate due dates at request time (see M-02).
- **Expected result:** Overdue worklist becomes real; dashboard stops lying; staff can chase loans.
- **Priority:** Critical · **Classification:** Functionality / Workflow

#### C-05 — Records staff and admins cannot be provisioned; roles silently downgraded
- **Module:** Settings → Register new user; public sign-up; `server.ts` signup (`SIGNUP_ROLES = ["DEPT_USER","AUDITOR"]`)
- **Problem:** Both user-creation UIs offer all five roles, but the server coerces anything except DEPT_USER/AUDITOR to DEPT_USER. There is **no admin create-user route and no role-edit API/UI** anywhere.
- **Reproduction [R]:** Signup with `role: RECORDS_OFFICER` → stored `DEPT_USER`; after admin approval still `DEPT_USER`. Browser: Settings modal offers "Records Officer / Records Administrator / System Administrator" with an "Auto-approve immediately" checkbox — selecting them produces a powerless account while the success message claims the account was created.
- **Why it matters:** An archive cannot operate with only department users: nobody can catalogue, approve loans, or manage locations except the single bootstrap admin. Staff onboarding — a day-one task — is impossible, and the UI deceives the admin doing it.
- **Recommendation:** Add an admin-only create-user endpoint that honors the chosen role (with temp password + forced change), plus a role-edit action in the user table; restrict public signup to DEPT_USER/AUDITOR and let admins assign roles at approval time. Remove the misleading role options from public signup (M-08).
- **Expected result:** Real staff provisioning; role model becomes usable.
- **Priority:** Critical · **Classification:** Functionality / Operational Capability

#### C-06 — Every date field reads back one day earlier than entered
- **Module:** All date display (documents, checkouts, retention, disposals) — `repository.dateStr()` + DATE columns (`migrate.ts` converts date columns to `DATE`)
- **Problem:** `pg` returns DATE columns as local-midnight `Date` objects; `dateStr()` formats them with `toISOString()` (UTC). In any UTC+ timezone (the deployment region is UTC+8) every date shifts back one day on read.
- **Reproduction [R]:** Created doc with `documentDate/retentionEndDate = 2023-06-01 / 2028-06-01` → read back **2023-05-31 / 2028-05-31**. Checkout due 2020-01-01 → stored/read **2019-12-31** (also observed in browser). Affects document_date, received/filed/retention/disposal dates, request/checkout/due/return dates.
- **Why it matters:** Archives are date-driven legal instruments. Retention expiry, due dates, and disposal eligibility are all computed from these values; a systematic one-day error corrupts every deadline and every printed report, silently.
- **Recommendation:** Format DATE values with local getters (`getFullYear/getMonth/getDate`) or configure `pg` date parsing to return strings; add a round-trip test.
- **Expected result:** Dates displayed exactly as recorded; deadlines correct.
- **Priority:** Critical · **Classification:** Functionality (data integrity)

### HIGH

#### H-01 — Unauthenticated "Switch Active Persona" shipped to production
- **Module:** Header user menu (`setCurrentUser` = client state + localStorage only)
- **Problem [R]:** Any signed-in user can instantly become any other user (including ADMIN) from a dropdown — no password, no server call. Server writes remain bound to the real JWT (so this is not direct server-side escalation), but the UI identity, role badge and audit-visible name change freely; the guard even references a nonexistent `/api/auth/impersonate` route.
- **Why it matters:** A demo convenience in a production accountability system: users can browse as admins, get confused about their own permissions, and lose trust in who-did-what. Combined with H-02 the result is inconsistent, unpredictable UI.
- **Recommendation:** Remove the persona switcher from production builds (or gate behind an explicit demo flag). If impersonation is genuinely needed for support, implement it server-side, admin-only, with audit entries.
- **Expected result:** One honest identity per session.
- **Priority:** High · **Classification:** UX / Functionality

#### H-02 — No role-appropriate UI: every user sees every admin surface
- **Module:** Sidebar, Settings page, Circulation buttons, detail-page actions
- **Problem [R/C]:** Sidebar renders all items for all roles; `SettingsPage` contains no role check; after persona-switching to DEPT_USER the browser still showed Settings, "Approve & Release" and "Reject". Server correctly returns 403 — but only *after* the user clicks.
- **Why it matters:** Department users and auditors see a wall of controls they cannot use; every attempt ends in an error toast. This is confusing, wastes time, and makes the system feel broken rather than permissioned.
- **Recommendation:** Drive navigation and action visibility from `currentUser.role` using the same role groups as `apiGuard`; show read-only states instead of dead buttons.
- **Expected result:** Each role sees exactly what it can do; errors become rare and meaningful.
- **Priority:** High · **Classification:** UX

#### H-03 — Bulk-update API accepts arbitrary fields (status, confidentiality, …)
- **Module:** `/api/documents/bulk-update`
- **Problem [R]:** The UI correctly sends only confidentiality/condition/department, but the API applies whatever it receives: `{updates:{status:'DISPOSED', confidentiality:'PUBLIC'}}` → 200, document became DISPOSED+PUBLIC with no lifecycle checks, no movement, no disposal record.
- **Why it matters:** Any records-role client (or compromised session) can mass-dispose or mass-declassify records, bypassing every business rule. Defense-in-depth failure on the most sensitive fields.
- **Recommendation:** Server-side whitelist of bulk-updatable fields; route status changes through lifecycle functions only.
- **Expected result:** Business rules cannot be bypassed via the API.
- **Priority:** High · **Classification:** Functionality (integrity/security)

#### H-04 — Fake digital surrogates: hardcoded "2.4 MB", no file, broken download
- **Module:** Quick-register (`DocumentsPage.tsx` L230–232), document detail digital-copy section
- **Problem [C]:** Checking "Attach Digitized Surrogate" stores `hasDigitalCopy: true`, a fabricated filename and `digitalFileSize: '2.4 MB'` — no upload happens. Detail page then offers a download that resolves to nothing.
- **Why it matters:** Staff will believe a digital preservation copy exists when it does not — the exact opposite of an archive's purpose. The real upload path (capture page → `/digital-copy`) works, making the inconsistency worse.
- **Recommendation:** Remove the checkbox from quick-register or wire it to the real upload; never display a size without a stored file.
- **Expected result:** `hasDigitalCopy` always means a retrievable file exists.
- **Priority:** High · **Classification:** Functionality

#### H-05 — Deleting a document with a REQUESTED/APPROVED checkout orphans the checkout
- **Module:** Document delete (`deleteDocument` guard only covers CHECKED_OUT)
- **Problem [R]:** Delete of a doc with a REQUESTED checkout → 200 success; checkout survives with `documentId: null`. (CHECKED_OUT delete is correctly blocked — verified.)
- **Why it matters:** Circulation list now contains ghost requests pointing at nothing; approving one hits "Document not found". Accountability trail is broken.
- **Recommendation:** Block deletion while any active checkout (REQUESTED/APPROVED/CHECKED_OUT/OVERDUE) exists, with a message naming the borrower; or cascade-cancel with audit.
- **Expected result:** No orphaned circulation records.
- **Priority:** High · **Classification:** Functionality

#### H-06 — Batch relocate shows failures as a green "Relocation Complete" success
- **Module:** `BatchRelocateModal.tsx` (catch → `setStep('done')`)
- **Problem [C]:** On any error the modal advances to the done step, which renders a green check and "Relocation Complete" heading; the failure text is a small subtitle. Partial failures (move succeeded, bundle update failed) also render as failure though documents moved.
- **Why it matters:** Physical relocation is irreversible shelf work. Officers told "complete" will not re-verify; the catalogue and the shelf diverge silently.
- **Recommendation:** Distinct error state (red, explicit failed-item list, retry); report per-item outcomes for partial success.
- **Expected result:** Staff know exactly what moved and what didn't.
- **Priority:** High · **Classification:** Functionality / UX

#### H-07 — Retention "Schedule review" is a fake action
- **Module:** `RetentionPage.tsx` L108–114
- **Problem [R]:** Clicking it only sets a local banner string ("Scheduled controlled disposal audit review for #…"). Nothing persists: navigate away and back → banner gone, row unchanged, no audit entry, no state.
- **Why it matters:** Retention review is a statutory duty. Staff believe a review was scheduled; nothing was. This is worse than a missing feature.
- **Recommendation:** Either implement a real review queue (scheduled date, assignee, status, audit) or remove the button until it exists.
- **Expected result:** No false compliance signals.
- **Priority:** High · **Classification:** Functionality

#### H-08 — Already-expired records are invisible on the Retention page
- **Module:** `RetentionPage.tsx` L15–20 (`expiry > today` filter)
- **Problem [R]:** A record whose retention expired in 2020 appears nowhere on the Retention page (browser full-text check); only *future* expiries within 5 years are listed. Dashboard counts it (1 past expiry) but offers no path to act.
- **Why it matters:** The records most urgently needing review/disposal are precisely the ones hidden from the review screen.
- **Recommendation:** Include expired records in a separate "Past expiry — action required" section with the same actions.
- **Expected result:** The riskiest records are the most visible.
- **Priority:** High · **Classification:** Workflow

#### H-09 — No password recovery path of any kind
- **Module:** Auth, Settings, seed
- **Problem [C]:** No forgot-password flow, no admin password reset, no reset API. The bootstrap admin password is random and printed **once** to the server log; the production DB's only admin was created via signup. If that password is lost, the system is permanently locked out (no DB-level recovery tooling shipped).
- **Why it matters:** A single forgotten password bricks the entire archive system. This is an operational single point of failure.
- **Recommendation:** Admin-initiated password reset (temp password + forced change) as minimum; email-based reset later. Document a break-glass procedure.
- **Expected result:** Lockout is recoverable without database surgery.
- **Priority:** High · **Classification:** Operational Capability

#### H-10 — Document detail delete reports success even when it fails
- **Module:** `DocumentDetailPage.tsx` delete handler
- **Problem [C]:** The handler treats the returned Promise as truthy (always true) instead of awaiting the result, then shows success and navigates away even when the server rejected the delete (e.g., checked-out guard).
- **Why it matters:** Staff believe a record was destroyed when it still exists — or worse, assume the system is unreliable. Pairs with H-05/H-06 as a pattern of dishonest feedback.
- **Recommendation:** Await the context call, branch on result, stay on page on failure with the server's reason.
- **Expected result:** Feedback always matches reality.
- **Priority:** High · **Classification:** Functionality

#### H-11 — No loading states, silent fetch failures, no multi-user refresh
- **Module:** `ArchiveContext` initial load + all pages
- **Problem [C]:** Entities load once at startup with no spinners/skeletons; failed fetches are swallowed; there is no polling/refetch, so two staff members working simultaneously see stale data until manual reload (e.g., a loan released by one officer still shows AVAILABLE to another, inviting double-checkout attempts).
- **Why it matters:** An archive desk is multi-user by nature. Stale state causes duplicate work, confusing errors, and mistrust; blank screens during load look like crashes.
- **Recommendation:** Loading skeletons + explicit error banners with retry; refetch on tab activation and after mutations (already partial); short polling or SSE for circulation/documents.
- **Expected result:** Users always know data freshness and can recover from failures.
- **Priority:** High · **Classification:** UX

#### H-12 — No disposal workflow end-to-end
- **Module:** Retention, documents, disposals table
- **Problem [C/R]:** A `disposal_records` table, CSV export and DISPOSED status exist, but no UI creates a disposal: no proposal, no approval, no certificate generation, no destruction logging. The only way to reach DISPOSED is the unfiltered bulk API (H-03). Retention page's only action is fake (H-07).
- **Why it matters:** Defensible disposal (proposal → authorization → destruction → certificate → audit) is a legal requirement for most archives; without it the retention module is decorative.
- **Recommendation:** Implement the disposal chain with dual approval and immutable certificate; until then, hide disposal affordances.
- **Expected result:** Retention lifecycle completes defensibly.
- **Priority:** High · **Classification:** Operational Capability

#### H-13 — Catalogue search crashed the whole app on records with a null reference number — FIXED
- **Module:** `DocumentsPage` search filter (`doc.referenceNumber.toLowerCase()`)
- **Problem [R]:** No null guard on `referenceNumber`; seed/legacy records carry `null`. Typing any query threw `Cannot read properties of null (reading 'toLowerCase')` and unmounted the entire React tree (no error boundary). Discovered during E7 browser verification (2026-11-23).
- **Fix applied:** `(doc.referenceNumber || '').toLowerCase()`; re-verified in the sandbox — incremental keystroke search renders results with zero console errors.
- **Priority:** High · **Classification:** Functionality (resolved)

### MEDIUM

#### M-01 — Raw database errors shown to end users as HTTP 500
**[R]** Notifications displayed `null value in column "current_location_id"… violates not-null constraint`; department creation without head returns `null value in column "head_name"…`; FK names leak in delete errors. Business/validation problems are indistinguishable from server crashes. **Fix:** validate inputs server-side with human messages ("Choose a staging location", "Department head is required"); map constraint violations to friendly 4xx. **Priority:** Medium · UX/Functionality

#### M-02 — No due-date validation
**[R]** A checkout request with due date 2020-01-01 (6 years past) was accepted. Combined with C-04, nothing ever flags it. **Fix:** require dueDate ≥ today (and sane upper bound) at request time. Medium · Functionality

#### M-03 — Batch-move allowed on CHECKED_OUT documents
**[R]** `batch-move` moved a document that is physically with a borrower; status stayed CHECKED_OUT. The shelf trail now claims a location the document isn't in. **Fix:** exclude active-loan documents with a clear per-item reason. Medium · Functionality

#### M-04 — Location hierarchy is unvalidated
**[R]** Created a BUILDING whose parent is a FOLDER (201). `updateLocation` also allows type/parent changes without checks (only the edit UI guards circular parents). Nonsensical trees corrupt paths and occupancy logic. **Fix:** enforce type-order (BUILDING>FLOOR>ROOM>…>FOLDER) and acyclicity server-side. Medium · Functionality

#### M-05 — Document-type deletion has no reference guard
**[R]** Deleting an in-use type → raw FK 500 (departments/locations have proper guards; types don't). In memory mode it would silently orphan documents. **Fix:** count references and refuse with an explanatory message, matching the department pattern. Medium · Functionality

#### M-06 — User deletion: one click, no confirmation, no last-admin guard
**[C]** Settings delete button calls `deleteUser` immediately; no ConfirmModal; nothing prevents deleting the final ADMIN (lockout, cf. H-09). **Fix:** confirmation naming the user + last-admin protection. Medium · UX/Functionality

#### M-07 — Password policy inconsistency (6 vs 8)
**[R/C]** Server requires ≥8 (verified: 6-char signup rejected); ProfileModal validates ≥6 and hints "Minimum 6 characters"; signup forms show no hint at all. Users hit unexplained rejections. **Fix:** single policy constant, hints everywhere. Medium · UX

#### M-08 — Public signup misrepresents privileged roles
**[R/C]** Sign-up offers "System Administrator (Full System Controller)" etc.; server silently downgrades; the pending screen then displays "Requested Role: System Administrator". Applicants and admins are both misled. **Fix:** offer only DEPT_USER/AUDITOR publicly; role assignment at approval (pairs with C-05). Medium · UX

#### M-09 — SEALED bundles are not enforced
**[C]** No code checks bundle status before scan-fill, relocate, edit, or document add/remove — a "sealed" box can be silently altered. **Fix:** block mutations on SEALED bundles (require explicit unseal with audit). Medium · Functionality

#### M-10 — Flat location pickers and arbitrary defaults
**[R/C]** Registration home-location, relocate destination, batch-relocate destination and create-location parent are flat dropdowns (paths shown — good — but no hierarchy navigation); batch-relocate defaults to `locations[0]` (any type) and auto-bundle to `departments[0]`. At scale (hundreds of nodes) flat lists are unusable and wrong defaults cause misfiles. **Fix:** hierarchical/tree picker with search; no silent defaults for physical destinations. Medium · UX/Workflow

#### M-11 — Location occupancy never displayed
**[C/R]** Locations store capacity and compute occupancy, but UI shows only "Cap: X". Staff cannot see how full a shelf/box is before filing. **Fix:** show occupancy/capacity with a fill indicator. Medium · UI/Operational

#### M-12 — Scanner UX cluster
**[C]** (a) 403 "no permission" is rendered as "not found", sending staff hunting for a record they may not access; (b) BatchRelocate scan step uses local-only lookup (no remote fallback, unlike the other flows); (c) bundle/camera flows navigate away and lose the current selection (literal TODO in BundlesPage Eye button, M-13); (d) demo "sample code" buttons remain in production scanner. **Fix:** distinguish 403/404 messages; shared lookup helper with fallback; preserve selection across navigation; remove demo buttons. Medium · UX/Functionality

#### M-13 — Bundles page "view documents" button is disconnected
**[C]** Eye button switches to Documents tab with a `// Could add document selection callback here` comment — no filter/selection applied; user lands on an unfiltered catalogue. **Fix:** navigate with bundle filter applied. Medium · Functionality

#### M-14 — Bundle QR tags generated as DOCUMENT entities
**[C]** `QRBarcodeModal entityType="DOCUMENT"` for bundles → wrong payload/label semantics; scanning resolves via bundle fallback but printed metadata is inconsistent. **Fix:** proper BUNDLE entity type. Medium · Functionality

#### M-15 — Home-location edits bypass the movement trail; "AT HOME" badge misleading
**[C]** EditDocumentModal can change home location without a movement record; the AT HOME badge compares current vs home even for checked-out documents' display contexts. Physical custody history develops gaps. **Fix:** route home changes through a relocation movement; badge logic tied to actual status. Medium · Workflow

#### M-16 — Rejection promises notifications that don't exist; hardcoded reason
**[C]** Reject flow says the requester "will be notified", but notifications are local-only to the acting user (L-06); rejection reason is a fixed string. Requesters never learn outcomes. **Fix:** persistent per-user notifications (server-stored) or remove the promise; free-text reason. Medium · UX

#### M-17 — Random reference/bundle numbers risk collisions
**[C]** REF/BNDL numbers use random suffixes without uniqueness checks (document numbers are race-safe; these are not). **Fix:** sequence-based generation like documents. Medium · Functionality

#### M-18 — Both intake paths compute retention from today, not document date
**[C]** Quick-register sets retentionStartDate = registration day (`DocumentsPage` L205–208); **the capture page does the same** (`DocumentCapturePage` L126 — corrected from the initial assessment, which credited the capture page with using the document date). The server stores the client-supplied dates verbatim (`repository.createDocument`), and editing the document date later never recomputes retention. A 2010 record registered today gets a fresh retention clock on **both** paths. **Fix:** compute retention server-side from documentDate + type.retentionYears on create and on date edit. Medium · Workflow (see also T-06)

#### M-19 — Scalability: full-collection fetches, unpaginated views, O(N) lookup
**[C]** All entities load fully into client memory; Checkouts/AuditLogs/Bundles have no pagination; `/api/lookup` scans every document/bundle/location per scan. Fine for hundreds of records; degrades at archive scale (tens of thousands). **Fix:** server-side pagination for lists; indexed lookup endpoint (QR/barcode columns are already unique). Medium · Performance/Operational

#### M-20 — User directory and all checkouts readable by every role
**[C]** `apiGuard` GET fall-through exposes `/api/users` (names, emails, departments) and all checkout records to DEPT_USER. Needed today only because of the persona switcher (H-01). **Fix:** restrict user directory to admins; scope checkout visibility to own requests for dept users. Medium · Privacy

#### M-21 — MISSING condition handled inconsistently between return flows
**[C]** Return dialog allows marking MISSING, but downstream status/occupancy handling differs between the two return paths; a "returned missing" document can remain AVAILABLE. **Fix:** single return implementation; MISSING triggers a flagged status + alert. Medium · Workflow

#### M-22 — AI bundle suggestion silently non-functional
**[C]** Placeholder API key + `.catch(() => {})` → button appears to work but never produces suggestions, with no error surfaced. **Fix:** hide/disable when unconfigured; surface configuration errors. Medium · Functionality

#### M-23 — CSS regression: invalid class `-tranzinc-y-1/2` (9 occurrences)
**[C]** DocumentsPage:479, DocumentTypeCombobox:177, LocationsPage:395, BundlesPage:270+282, Header:146+160+404+419. Intended `-translate-y-1/2`; icons in inputs/buttons are vertically misaligned. **Origin disclosure:** introduced by the earlier color-palette alignment pass in this workspace. **Fix:** restore `-translate-y-1/2`. Medium · UI

### LOW

- **L-01 — Mobile header title truncates to "Ar…" at 390px; catalogue table scrolls horizontally (~1844px).** [R] Functional but rough; consider card layout for tables on phones. Low · UI
- **L-02 — Quick-register modal lacks the draft option the capture page offers.** [R] Inconsistent intake paths. Low · UX
- **L-03 — QR claim shows raw user ID (`qrClaimedBy`) instead of a name.** [C] Low · UI
- **L-04 — Status filter options don't cover all statuses in use.** [C] Low · UI
- **L-05 — CSRF check passes when Origin/Referer absent.** [C] SameSite=Strict mitigates; still worth rejecting missing-origin mutations. Low · Security hardening
- **L-06 — Notifications are local-only, capped at 10, no history/persistence.** [C] Underpins M-16; cross-session accountability needs server-stored notifications. Low · UX

### ACCESSIBILITY

- **A-01 — Locations tree nodes, child cards and document rows are click-only `<div>`s.** [C] Keyboard users cannot expand/navigate storage at all; no roles/tabindex/keydown handlers. **Fix:** buttons or proper tree semantics with arrow-key navigation. Medium-severity accessibility gap.
- **A-02 — Custom comboboxes/menus have inconsistent focus & ARIA semantics.** [C, partial] DocumentTypeCombobox and persona menu lack full listbox/option semantics and focus trapping in places. **Fix:** adopt a consistent accessible primitive. Low–Medium.

---

## D. Missing or Recommended Capabilities

### Essential (operationally required)
| Capability | Problem it solves | Users | Justification |
|---|---|---|---|
| **Overdue engine** (C-04) | Loans never flagged; dashboard misreports | Circulation officers | Chasing overdue material is a daily duty and compliance requirement |
| **Admin user provisioning + role edit** (C-05) | Staff cannot be onboarded | Admins | System is unusable beyond one person without it |
| **Password reset / break-glass** (H-09) | Permanent lockout risk | Admins | Single-admin systems must be recoverable |
| **Working backup restore** (C-02) | Disaster recovery impossible | Admins | Archives of record must survive hardware loss |
| **Disposal chain with approval + certificate** (H-12) | Retention ends nowhere | Records admins, auditors | Legal defensibility of destruction |
| **Persistent notifications** (M-16/L-06) | Requesters never learn outcomes | Dept users | Borrow requests are asynchronous by nature |
| **Server-side field whitelists + input validation** (H-03/M-01) | API bypasses business rules; raw SQL errors | Everyone | Integrity and comprehensible errors |
| **Data freshness (refetch/polling)** (H-11) | Multi-user stale state | Desk staff | Two officers cannot share one stale view |
| **Continuous high-volume intake** (T-01/T-02/T-05, E7–E9) | 300/day costs a full staff-day of desk time as-is | Records officers | The stated operational volume is unachievable without conveyor-style intake and a tagging station |

### Optional (valuable, not day-one blockers)
| Capability | Justification |
|---|---|
| Hierarchical location picker + occupancy display (M-10/M-11, T-04) | Speeds filing and prevents overfilling once the tree grows |
| Duplicate detection at registration (T-03) | Prevents double-accessioning of the same physical record — a classic archive error |
| Operational reports (PDF/summary: holdings by dept/location, circulation stats, retention forecast) | Currently only raw CSV exports; managers need summaries for planning and compliance reporting |
| Saved searches / frequent filters (T-09) | Retrieval is the most repeated task; reduces re-keying |
| Label print templates (batch QR sheets) (T-02) | BulkTagPrint exists; standardized sheet layouts save label stock and time |
| Full-text search across descriptions/custom fields | Retrieval beyond exact filters at scale |
| Reader/services desk mode (requester self-service status page) | Reduces "where is my request?" interruptions |
| Retention calendar + review assignments | Turns H-07's fake button into a real compliance workflow |

*Deliberately not recommended:* workflow engines, OCR/AI auto-classification, multi-tenant features — no observed operational need justifies the complexity at this stage.

---

## E. Workflow Improvement Proposals

### E1. Loan approval & release (fixes C-01)
**Existing:** Officer clicks "Approve & Release" → two un-awaited calls → dispatch fails (no staging location) → record stuck APPROVED, no actions, invisible in workflow tabs.
**Proposed:** Click opens a small "Release loan" dialog: borrower summary + **required staging/temporary location picker** (hierarchical, defaults to circulation desk) + optional note → Confirm runs `await approve` then `await dispatch(location)` → success toast + row moves to Active with due date; on failure the row stays REQUESTED with the reason shown. APPROVED rows (legacy/edge) get "Release" / "Cancel approval" actions.
**Gain:** 1 reliable step instead of a broken 2-call race; no limbo states; physical handover always has a location trail.

### E2. Staff onboarding (fixes C-05, M-08)
**Existing:** Admin picks "Records Officer" in Settings → account silently created as DEPT_USER → admin believes staff is provisioned → officer can't work → no way to fix role.
**Proposed:** Settings "Add staff" (admin-only API) creates the account with the chosen role + temporary password + forced change at first login; public signup offers only Department User/Auditor; approval screen lets admin adjust role before activating.
**Gain:** Onboarding works first time; roles mean what they say; no silent downgrades.

### E3. Overdue management (fixes C-04, M-02)
**Existing:** Due date accepted even in the past; nothing ever compares dates; Overdue tab permanently 0; dashboard claims "All within due dates".
**Proposed:** Due date validated ≥ today at request; overdue derived live (`CHECKED_OUT && dueDate < today`) powering the Overdue tab, badges, dashboard KPI and a "Chase overdue" worklist with one-click reminder (persistent notification to borrower); optional nightly status flip + audit.
**Gain:** The circulation desk's core chasing workflow becomes possible; dashboard truthful.

### E4. Retention → disposal (fixes H-07, H-08, H-12)
**Existing:** Retention page lists only future expiries; "Schedule review" shows a banner that vanishes; expired records hidden; no disposal path.
**Proposed:** Two queues — "Past expiry (action required)" and "Expiring ≤ 5 years". Actions: *Schedule review* (persists date/assignee/status + audit) → *Propose disposal* (second records-admin approves) → *Record destruction* (date, method, witness) → immutable certificate + document status DISPOSED + movement/audit entries.
**Gain:** Statutory retention lifecycle completes with accountability; riskiest records surface first.

### E5. Backup & restore (fixes C-02)
**Existing:** Export works; import deletes departments first → FK abort on any populated DB → restore impossible when actually needed.
**Proposed:** Single-transaction restore in FK-safe dependency order with a pre-flight summary ("will replace N documents, M users…") and the existing explicit confirmation; post-restore integrity check (counts + FK validation) reported in UI.
**Gain:** Disaster recovery actually works; admins can trust backups.

### E6. Physical filing picking (mitigates M-10, M-11)
**Existing:** Flat dropdown of every location (paths appended); batch-relocate silently defaults to the first location in the array; occupancy invisible.
**Proposed:** Hierarchical picker with type-ahead search showing `Building → Floor → Room → Shelf` and occupancy bars; destination must be explicitly chosen (no array-index defaults); capacity warnings when overfilling.
**Gain:** Faster, correct filing at scale; fewer misfiles and overfilled boxes.

### E7. Continuous registration conveyor (fixes T-01, T-04, T-07; mitigates M-17)
**Existing:** Register → modal closes → reopen → re-verify defaults → type → save → full catalogue refetch; repeat 300×.
**Proposed:** An intake mode where the primary button is **"Save & register next"**: modal stays open, per-record fields clear, title auto-focused, assigned number shown with a session counter; dept/type/home persist as explicit last-used presets (capture-page pattern) instead of array-index defaults; save trusts the server-returned record (no full refetch); optional duplicate warning before commit (T-03); reference numbers sequence-generated instead of random.
**Gain:** ~15–25 s/record instead of 30–50 s; constant save latency at any archive size; no silent misfiles.
**Status: IMPLEMENTED & browser-verified (2026-11-23).** "Save & register next" (Enter also continues) + "Save & close"; session counter + last-number banner; title auto-focus; explicit last-used presets replace array-index defaults (T-04); post-save full refetch removed, occupancy mirrored locally (T-07); sequential REF numbers (M-17 mitigation). Verified: 3 consecutive registrations kept context, sequential doc numbers (…0008→0009→0010) and refs (REF-0001→0003), presets remembered on reopen. Also fixed H-13 (search crash) found during verification.

### E8. Tagging station: register → print → affix → claim in one loop (fixes T-02)
**Existing:** Tag values created at registration, but printing lives on the detail page / bulk selection and claiming lives in the scanner — three disconnected surfaces.
**Proposed:** A "Tagging" queue of registered-but-unclaimed records (data already exists: `qrClaimed` flag + filter): batch-select → print standard label sheets (extend BulkTagPrint) → affix → continuous scan-to-claim with audio feedback and auto-advance to the next unclaimed record. Registration success state links straight into the queue.
**Gain:** Tagging drops from 20–40 s to ~8–15 s/record; the 300/day tagging backlog becomes a single standing station task.

### E9. One-pass photo intake + draft completion queue (fixes T-05, L-02)
**Existing:** Capture saves DRAFT only (photo mandatory), navigates away per save; finalization is one-at-a-time through the edit modal.
**Proposed:** "Save & capture next" stays in the workspace; when metadata is complete in-session, offer "Save as available" directly; a draft-completion queue with prev/next navigation and keyboard finalize; bulk-finalize drafts whose required fields are already present. Quick-register gains the same draft option for parity.
**Gain:** Photo path becomes viable at 300/day (one pass instead of two); drafts stop accumulating.

### E10. Retrieval express lane (fixes T-09…T-13; depends on C-01)
**Existing:** Search (unindexed, no ranking) → open detail → read location → walk → full checkout chain; scan results only identify.
**Proposed:** Ranked search incl. description with exact-number boosting and document-date range filter; row-level quick actions (Check out / Print tag); act-on-scan buttons on the scanner result card (Check out / Relocate here); a **pick list** grouping approved requests + ad-hoc picks by location path with a printable pick sheet, so one shelf trip serves many retrievals.
**Gain:** Retrieval desk time roughly halves; shelf walking is batched; the scan moment becomes an action moment.

---

## F. Prioritized Improvement Roadmap

### Phase 1 — Immediate fixes (stop the bleeding; est. small, surgical changes)
1. **C-01** Release-loan dialog with required staging location + sequential awaits + APPROVED-state recovery actions.
2. **C-03** Remove department fields from self-profile whitelist.
3. **C-06** Fix `dateStr` timezone formatting (one function).
4. **H-03** Server-side whitelist for bulk-update fields.
5. **H-06** BatchRelocate honest error/partial-failure states.
6. **H-10** Await delete result; truthful feedback.
7. **H-05** Block delete while any active checkout exists.
8. **M-23** Restore `-translate-y-1/2` (9 spots).
9. **H-01/M-12d** Remove persona switcher + demo sample buttons from production.

### Phase 2 — High-impact usability (make daily work honest and smooth)
1. **C-05 + M-08** Admin provisioning + role edit; honest public signup.
2. **H-02** Role-driven navigation/action visibility mirroring apiGuard.
3. **C-04 + M-02** Live overdue derivation + due-date validation + worklist.
4. **H-11** Loading states, error banners with retry, refetch-on-activation/polling.
5. **M-01** Human-readable validation errors; proper 4xx mapping.
6. **H-09 + M-06** Admin password reset; delete confirmations; last-admin guard.
7. **M-07** Unified password policy + hints.
8. **A-01/A-02** Keyboard-accessible location tree and consistent combobox semantics.
9. **T-01 + T-07** "Save & register next" continuous intake + drop the redundant post-save full refetch (small changes, largest throughput gain). — **DONE (2026-11-23, E7 implemented incl. T-04 presets + M-17 sequential refs; H-13 search crash fixed).**

### Phase 3 — Operational workflow improvements
1. **C-02** FK-safe transactional restore with pre-flight.
2. **H-07 + H-08 + H-12** Real retention review queues + disposal chain with certificates.
3. **M-16 + L-06** Persistent server-stored notifications (request outcomes, overdue reminders).
4. **M-03/M-04/M-05/M-09** Lifecycle & hierarchy guards (checked-out moves, location type order, type-delete guard, SEALED enforcement).
5. **M-15/M-21/M-18** Movement-trail completeness; unified return handling; retention anchored to document date.
6. **M-10/M-11** Hierarchical pickers + occupancy display.
7. **H-04** Remove or wire the fake digital-surrogate checkbox.
8. **T-02 + T-05** Tagging station (print queue + scan-claim loop) and one-pass photo intake with draft-completion queue (E8/E9).
9. **T-04 + T-06** Explicit last-used intake presets (no array-index defaults); server-side retention anchored to document date (with M-18).
10. **T-11 + T-12** Catalogue row quick actions and act-on-scan buttons (role-gated).

### Phase 4 — Long-term enhancements
1. **M-19** Server-side pagination + indexed scan lookup; list virtualization.
2. **T-08/T-09/T-10** Indexed/ranked search incl. description, document-date range filter, saved searches; duplicate detection at registration (T-03).
3. **T-13** Pick list / batched retrieval worklist grouped by location (after C-01/E1).
4. Operational reports (holdings, circulation, retention forecast) beyond CSV.
5. Retention calendar & review assignments; reader self-service status.
6. Optional: real admin impersonation (audited), email notifications, PWA/offline scanner resilience.

---

## G. Final Assessment

**Status: Requires significant improvements before it can be relied upon for daily archive operations.**

ArchiveHub is not a hollow shell — its foundations are unusually solid for a system of this kind: transactional circulation with row locks, race-safe numbering, atomic QR claiming, hardened file uploads, a coherent server-side permission model, referential delete guards, and genuinely well-designed screens (catalogue, scan-fill, dashboard worklist). The visual system is consistent and readable, and mobile behavior is largely sound.

However, **five independent blockers each alone prevent responsible daily use**:
1. The primary circulation action ("Approve & Release") fails on every attempt and strands records with no recovery path (C-01).
2. No records staff can ever be provisioned — the role model is unreachable in practice (C-05).
3. Overdue tracking, a core archival duty, is fictional and the dashboard actively misreports it (C-04).
4. Backups cannot be restored onto a live database (C-02).
5. Any user can self-grant access to other departments' confidential records (C-03) — and every date in the system reads back one day early (C-06).

Around these sit a pattern of **dishonest feedback** (fake success screens, fake digital copies, fake scheduling buttons, false success on failed deletes) that is especially dangerous in an archive context, where staff act on the system's word when moving, releasing, or destroying physical records.

**Recommendation:** Do not deploy for live circulation or as the system of record yet. A limited **cataloguing-only pilot** (registration, locations, search, QR tagging — all verified working) is feasible with the C-03/C-06/H-03 fixes applied first — but note that even a cataloguing pilot at the target volume of ~300 documents/day will be slowed by the intake-friction findings in **Section H** (T-01, T-02, T-05, T-07 are the highest-leverage fixes). Completing **Phase 1 + Phase 2** of the roadmap (mostly small, surgical changes) would move the system to **partially ready**; adding Phase 3 makes it **genuinely ready for daily operational use**. The distance to readiness is short in engineering terms — the architecture is right; the missing pieces are correctness, honesty of feedback, and a handful of operational workflows.

---

## H. Operational Throughput Review — Registration & Retrieval at 300 Documents/Day

**Why this section exists:** Sections C–G verified *correctness* of the workflows. This section evaluates their *speed and seamlessness* end-to-end — intake (physical/digital registration, metadata, QR/barcode assignment, location filing) through retrieval (search, locate, pull) — against the stated operational target of **~300 registrations per day** (~78,000/year at 260 working days). Findings use the same verification legend; time figures are **estimates [E]** from step counts, not stopwatch measurements, and say so explicitly.

### H.1 Coverage check of the original report

The original report traced capture → filing → checkout → return and verified each step's correctness, but it did **not** measure the flows as repetitive daily work: no step-count/time analysis, no volume projection, and several intake-specific frictions were unrecorded. Partial coverage existed in M-10 (flat pickers), M-18 (retention anchor — corrected above), M-19 (full fetches), L-02 (no draft in quick-register) and the D-options table (duplicate detection, saved searches, label sheets). This section closes that gap with findings **T-01…T-13** and proposals **E7…E10**.

### H.2 Registration flow — as-is walkthrough

**Path A — Quick-register (metadata-first, the volume path):**
| # | Step | Where | Friction |
|---|---|---|---|
| 1 | Click "Register document" | Documents header | Modal must be reopened for **every** record (T-01) |
| 2 | Verify/choose department + type | Modal | Defaults to `departments[0]` / first type — silent, possibly wrong (T-04) |
| 3 | Type title (required), optional ref # | Modal | Ref left blank → random `REF-####` (M-17) |
| 4 | Fill type custom fields (if any) | Modal | Well designed; live disambiguation preview is a strength |
| 5 | Choose home location | Modal | Flat dropdown of **every** node, defaults to `locations[0]` of any type (T-04, M-10); no occupancy info (M-11) |
| 6 | Confidentiality / condition / date | Modal | Defaults CONFIDENTIAL / EXCELLENT / today — reasonable, persisted between saves |
| 7 | Submit | Modal | Server assigns race-safe structured number (strength); **modal closes**, title/ref reset (T-01); full refetch of documents+locations+auditLogs after **each** save (T-07) |
| 8 | Print QR tag | Detail page → QR modal, or select rows → Print Tags | Not reachable from the registration success state (T-02) |
| 9 | Affix label, scan to claim | Scanner | Separate station/screen; claim status only visible afterwards (T-02) |

**Path B — Photo-first capture (cover-first intake):** presets (dept/type/home) are remembered in localStorage — a genuine strength. But: ≥1 photo is **mandatory** to save; every save creates a DRAFT and **navigates away to the detail page** (re-enter the workspace per document); drafts are finalized **one at a time** through the edit modal's "Complete record and make it available" select — no batch finalize, no completion queue with keyboard flow (T-05). Both paths anchor retention to *today* (M-18/T-06), and neither checks for duplicates (T-03).

### H.3 Retrieval flow — as-is walkthrough

| # | Step | Where | Friction |
|---|---|---|---|
| 1 | Search by # / title / ref / subject / dept / bundle / location path / custom fields | Header (auto-jumps to Documents) or catalogue toolbar | Client-side substring scan of the **whole** collection per keystroke; description not searched; no ranking/fuzzy (T-08, T-09) |
| 2 | Narrow by filters | Catalogue | Date-range filter matches **registration date only**, not document date (T-10); status list incomplete (L-04) |
| 3 | Identify the record | Table row | Home + current location breadcrumbs visible in-row (strength); but row actions are only Open/Edit/Delete — no check-out, no print-tag (T-11) |
| 4 | Confirm physical position | Detail page | Home vs current cards, custody + due date when checked out, clickable breadcrumbs → Locations (strength) |
| 5 | Walk to shelf & pull | Physical | No pick list batching multiple retrievals into one shelf trip (T-13) |
| 6 | Record the pull | Detail → Check Out → purpose + due date → REQUESTED → desk approval → release | Release step broken (C-01); every pull needs the full request chain — no quick-pull for staff |
| 7 | Scan-assisted alternative | Scanner modal | Excellent decode engine + remote fallback; result card shows location but offers **only** "View Record Master Page" — no act-on-scan (T-12) |

### H.4 Time budget at 300/day [E]

Assumptions: competent touch-typist (~40 wpm), average title 6–8 words, local-network server, mouse-driven UI; desk time only (physical handling excluded). Ranges reflect collection growth (flat dropdowns and full refetches get slower as the archive grows).

| Operation (per document) | As-is | With E7–E10 fixes |
|---|---|---|
| Quick-register: open modal + verify defaults + title + location pick + submit | 30–50 s | 15–25 s (continuous mode, tree picker, no reopen) |
| Tagging: print + affix + scan-claim (disconnected screens) | 20–40 s | 8–15 s (batch print queue + scan-claim station) |
| **Registration subtotal** | **50–90 s → 4.2–7.5 h/day for 300** | **23–40 s → 1.9–3.3 h/day** |
| Photo capture pass (presets + photo + save) | 40–60 s | 30–45 s (stay-in-workspace) |
| Draft finalization pass (open, edit modal, complete, save) | 30–60 s | 0–15 s (finalize in-session or batch) |
| **Photo-path subtotal** | **70–120 s → 5.8–10 h/day for 300** | **30–60 s → 2.5–5 h/day** |
| Retrieval: search → locate → record pull (excl. walking) | 45–90 s | 20–40 s (indexed search, row/scan quick actions, pick list) |

**Conclusion [E]:** at 300/day the as-is registration flow consumes roughly **one full staff-day or more** before any physical filing, and the photo path is not viable at that volume without the two-pass fix. The fixes are predominantly small UI changes (keep modal open, batch queues, remove redundant refetch) — the server foundation (race-safe numbering, atomic claim, transactions) already supports them.

### H.5 Detailed throughput findings

Priority scale as in Section C. All are **[C]** code-verified unless marked **[P]** (opportunity) or **[E]** (estimate).

#### T-01 — No continuous-intake mode: the form closes after every save
- **Module:** `DocumentsPage.handleRegisterSubmit` (L239–247); capture `onSaved` (L401–411)
- **Problem:** After each successful registration the modal closes and title/ref/subject/description reset; dept/type/location persist but the operator must click "Register document" again. Photo capture navigates to the detail page after every save. There is no "Save & register next", no Enter-to-submit-and-continue, no auto-focus on the title field on reopen.
- **Impact at 300/day [E]:** ~4–6 s of pure modal churn per record ≈ **20–30 min/day**, plus broken rhythm and higher misfile risk when re-verifying defaults each time.
- **Recommendation:** Add a "Save & next" primary action (and make it the default in a dedicated intake mode): keep the modal open, clear only per-record fields, focus the title, show the assigned number + a running session count ("12 registered this session"). Capture page: "Save draft & capture next" stays in the workspace.
- **Expected result:** Intake becomes a conveyor: scan/type → save → next, without navigation. **Priority:** High · Workflow/UX

#### T-02 — QR/barcode lifecycle is disconnected from registration
- **Module:** Registration → `QRBarcodeModal` (detail) / `BulkTagPrintModal` (selection) → scanner claim
- **Problem:** The server generates QR/barcode values at registration (strength), but nothing connects *register → print → affix → claim*: no print affordance on the success state, no "unprinted tags" queue, no rapid claim station. An operator tagging 300 records must either open 300 detail pages or repeatedly re-select rows in the catalogue, print, then switch to the scanner to claim one-by-one.
- **Impact at 300/day [E]:** 20–40 s/record of screen-hopping ≈ **1.7–3.3 h/day**.
- **Recommendation:** A **tagging station**: queue of registered-but-unclaimed records (the `qrClaimed` flag and filter already exist), batch sheet printing (BulkTagPrint exists — extend with standard label-sheet layouts), then a continuous scan-to-claim loop with audio feedback and auto-advance (the atomic claim API and scanner engine already exist). Optionally auto-open the print dialog after a registration session ends.
- **Expected result:** Register → print sheet → affix → scan through the stack; tagging drops to ~10 s/record. **Priority:** High · Workflow

#### T-03 — No duplicate detection at registration [P]
- **Module:** Both intake paths; `repository.createDocument`
- **Problem:** Nothing warns when title + department + document date (or reference number) closely matches an existing record. At 300/day, double-accessioning the same physical document is a statistical certainty over a year; it creates phantom holdings and split circulation history.
- **Recommendation:** Server-side fuzzy check (normalized title/ref + dept + date window) returning "possible duplicate of #…" with view/anyway-register options; exact reference-number match should hard-warn.
- **Expected result:** One physical record = one registry record. **Priority:** Medium · Data integrity

#### T-04 — Silent array-index defaults on intake (extends M-10)
- **Module:** `DocumentsPage` L123/L130–131 (`departments[0]`, first type, `locations[0]`); `EditDocumentModal` L64–65; relocate modal `locations[0]`
- **Problem:** Quick-register pre-selects the first department and the **first location of any type** (could be a BUILDING). A fast operator pressing through 300 records can silently misfile dozens into wrong departments/locations; the capture page's explicit "select" placeholders are the safer pattern.
- **Recommendation:** No silent defaults for physical destinations; remember the operator's last-used dept/type/location as *explicit* presets (capture page already does this — reuse the pattern), and validate location type server-side (pairs with M-04).
- **Expected result:** Speed without misfiles. **Priority:** Medium · Workflow

#### T-05 — Photo intake is a forced two-pass workflow with no batch completion
- **Module:** `DocumentCapturePage` (photo required, L103/L245); `EditDocumentModal` draft select (L197–205); drafts banner (`DocumentsPage` L443–469)
- **Problem:** Capture can only save DRAFTs and requires ≥1 photo; finalization happens one record at a time via the edit modal. The drafts worklist banner is good, but "Review drafts" just applies a filter — there is no completion queue (next-draft navigation, keyboard flow) and no bulk "complete all with defaults". At 300/day the second pass doubles desk time (H.4).
- **Recommendation:** (a) "Save & capture next" (T-01); (b) allow finalizing directly in the capture session when metadata is entered; (c) a draft-completion queue with prev/next and one-keyboard-shortcut finalize; (d) bulk-finalize for drafts whose required metadata is already present.
- **Expected result:** Photo intake viable at volume; drafts stop accumulating. **Priority:** High · Workflow

#### T-06 — Retention clock anchored to registration day on both paths (see M-18)
- **Module:** `DocumentsPage` L205–208; `DocumentCapturePage` L106–127; server stores verbatim
- **Problem/Impact:** Backlog registration (the normal case when digitizing 300/day) systematically extends retention of older records — a compliance error that scales with intake volume.
- **Recommendation:** Compute retention server-side from documentDate + type.retentionYears; recompute on document-date edit; show the computed expiry live in both forms.
- **Priority:** Medium · Compliance (cross-ref M-18)

#### T-07 — Every registration re-downloads the entire catalogue (extends M-19)
- **Module:** `ArchiveContext.addDocument` L903–904: optimistic insert **then** `refreshEntities('documents','locations','auditLogs')`
- **Problem:** The new record is already in state; the full refetch is redundant. At 300/day that is 300 full-collection downloads of a growing dataset (~78k records/year), each blocking the UI's data freshness and adding seconds of latency per save as the archive grows.
- **Recommendation:** Trust the server's returned record (already validated); refetch only locations if occupancy changed; move lists to server-side pagination (M-19) so refresh cost is bounded.
- **Expected result:** Save latency stays constant regardless of archive size. **Priority:** Medium · Performance

#### T-08 — Search is an unindexed full-collection scan per keystroke (extends M-19)
- **Module:** `DocumentsPage.filteredDocs` L272–293; `locationUtils.getLocationAncestors` builds a fresh Map of all locations **per call**
- **Problem:** Every keystroke filters all documents and computes two location paths per document (each rebuilding the location map) — O(D×L) work on the main thread with no debounce. Fine at hundreds of records; at tens of thousands the search box — the primary retrieval tool — becomes visibly laggy.
- **Recommendation:** Precompute a lowercase search blob + cached path per document (memoized on entity change); debounce input; longer term server-side search with indexed columns (numbers/QR/barcode are already UNIQUE).
- **Priority:** Medium · Performance

#### T-09 — Search coverage and ranking gaps [C/P]
- **Module:** `DocumentsPage` match list L280–290
- **Problem:** `description` is not searched (only subject); substring matching has no ranking — an exact document-number hit can sit below dozens of partial title matches; no typo tolerance; no field-scoped queries (e.g. `ref:…`).
- **Recommendation:** Include description; rank exact number/ref matches first; simple token/fuzzy matching; optional field prefixes. Saved searches (already in D-options) compound this gain for repeated retrieval patterns.
- **Priority:** Medium · UX/Retrieval

#### T-10 — Date-range filter matches registration date, not document date
- **Module:** `DocumentsPage` L321–326 (`createdAt`)
- **Problem:** "Find all contracts dated 2019–2021" is impossible with the filter; users must scan titles. Retrieval by document-date range is a core archive query.
- **Recommendation:** Offer both dates as filter targets (document date default, registration date optional).
- **Priority:** Low–Medium · Retrieval

#### T-11 — Catalogue rows offer no retrieval quick actions
- **Module:** `DocumentsPage` row actions L1003–1034 (Open/Edit/Delete only)
- **Problem:** Acting on a found record always requires opening the full detail page. For the most common actions — request checkout, print tag, relocate — that is 2 extra navigations per retrieval.
- **Recommendation:** Row-level quick actions (Check out, Print tag) with the same role gating as the detail page; keep the row click → detail behavior.
- **Priority:** Medium · UX/Retrieval

#### T-12 — Scan result is a dead end: identify only, no act-on-scan
- **Module:** `CameraQRScannerModal` document result card L336–348
- **Problem:** After a successful document scan the only action is "View Record Master Page". An officer standing at the shelf with the item in hand must navigate to the detail page to check out/relocate — the scan moment is exactly when those actions are needed. (The relocate modal's destination-scan already proves the act-on-scan pattern works.)
- **Recommendation:** Add "Check out", "Relocate here", "Print tag" buttons on the scan result card (role-gated), keeping continuous-scan mode for inventory passes.
- **Priority:** Medium · Workflow/Retrieval

#### T-13 — No pick list / batched retrieval [P]
- **Module:** Circulation + Locations (capability gap)
- **Problem:** Each retrieval is an independent search-and-walk. Ten requests for items on the same shelf mean ten trips. There is no "today's pulls" view grouped by location path, and no print-friendly pick sheet.
- **Recommendation:** A retrieval worklist (approved requests + ad-hoc picks) sorted/grouped by location path with a printed pick sheet; mark items pulled in one pass. Depends on C-01's fixed release flow.
- **Expected result:** One shelf trip serves many requests; retrieval time per item drops sharply. **Priority:** Medium · Workflow

### H.6 What already works well for these flows (verified strengths)

- **Race-safe structured numbering** (`{DEPT}-{TYPE}-{NNNN}`, server-side, UNIQUE) with live preview in the form — no number collisions even with concurrent intake clerks.
- **Capture presets** remembered per workstation (dept/type/home) — the right pattern; extend it to quick-register (T-04).
- **Home vs current location** shown everywhere that matters: catalogue columns, detail cards, scan results — with clickable breadcrumbs into the storage tree.
- **Scanner engineering:** self-hosted ZXing WASM in a Web Worker, tight scan region, inversion tolerance, dedupe, audio feedback, remote-lookup fallback for tags registered on other workstations.
- **Bulk tag printing, pagination, filter toolbar, drafts banner, global header search** — the scaffolding for a high-volume desk already exists; T-findings are about connecting it into continuous flows, not rebuilding it.

---

## Appendix — Evidence & Reproduction

All evidence lives in `audit-sandbox/` (disposable; application source untouched):
- `repro.mjs` / `repro-results.json` / `repro-console.txt` — C-01, C-02, C-04, C-05, H-05, M-02, M-03, M-05, T1b recovery proof.
- `repro2.mjs` / `repro2-results.json` — C-03 clean escalation (403→200), C-01 UI race, valid return flow (works), M-04 (BUILDING under FOLDER), H-03 (bulk status abuse).
- `repro3.mjs` / `repro3-console.txt` — C-06 date round-trip shift.
- `shot-*.png` — browser evidence: dashboard, circulation tabs, post-approve limbo + raw SQL notification, persona switch, retention (empty + banner), register-user modal roles, signup roles, detail page, relocate dialog, capture form, mobile layout.
- To re-run: `docker start archivehub-audit-db`, then from `audit-sandbox/`: `npx tsx server.ts` (port 3032; admin `audit-admin@test.local` / `AuditTest-Admin-2026`), then `node repro.mjs` etc. Stop afterwards: `docker stop archivehub-audit-db`.

**Production safety statement:** the owner's live instance (port 3031) and Supabase database were never written to; the only production access was a read-only user listing to plan the sandbox. All test records were AUDIT-TEST prefixed and confined to the disposable container.