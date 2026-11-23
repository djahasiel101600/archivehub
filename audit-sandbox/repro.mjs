// AUDIT SANDBOX reproduction script - targets ONLY localhost:3032 throwaway DB.
const BASE = 'http://localhost:3032';
const results = [];
function log(id, name, detail) {
  results.push({ id, name, detail });
  console.log(`\n=== ${id}: ${name} ===`);
  console.log(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 1));
}
async function api(method, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = res.headers.get('set-cookie');
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, cookie: setCookie ? setCookie.split(';')[0] : cookie };
}

// --- Setup: login as bootstrap admin ---
const login = await api('POST', '/api/auth/login', { email: 'audit-admin@test.local', password: 'AuditTest-Admin-2026' });
if (login.status !== 200) { console.error('LOGIN FAILED', login); process.exit(1); }
const admin = login.cookie;
log('SETUP', 'admin login', { status: login.status, role: login.json?.user?.role });

// Ensure reference data exists (fresh DB may be empty)
let depts = (await api('GET', '/api/departments', undefined, admin)).json;
let deptA = depts.find(d => d.code === 'AUDITA');
if (!deptA) deptA = (await api('POST', '/api/departments', { name: 'AUDIT-TEST Dept A', code: 'AUDITA', headName: 'AUDIT Head A' }, admin)).json;
let deptB = depts.find(d => d.code === 'AUDITB');
if (!deptB) deptB = (await api('POST', '/api/departments', { name: 'AUDIT-TEST Dept B', code: 'AUDITB', headName: 'AUDIT Head B' }, admin)).json;

let locs = (await api('GET', '/api/locations', undefined, admin)).json;
let shelf = locs.find(l => l.code === 'AUDIT-SHELF');
if (!shelf) {
  let bld = locs.find(l => l.type === 'BUILDING');
  if (!bld) bld = (await api('POST', '/api/locations', { name: 'AUDIT-TEST Building', code: 'AUDIT-BLD', type: 'BUILDING', parentId: null, capacity: 100 }, admin)).json;
  shelf = (await api('POST', '/api/locations', { name: 'AUDIT-TEST Shelf', code: 'AUDIT-SHELF', type: 'SHELF', parentId: bld.id, capacity: 50 }, admin)).json;
}
let types = (await api('GET', '/api/document-types', undefined, admin)).json;
let dtype = types.find(t => t.code === 'AUDIT-TYPE');
if (!dtype) dtype = (await api('POST', '/api/document-types', { name: 'AUDIT-TEST Type', code: 'AUDIT-TYPE', retentionYears: 5, customFields: [] }, admin)).json;

const mkDoc = (title, extra = {}) => api('POST', '/api/documents', { docData: {
  title, departmentId: deptA.id, departmentName: deptA.name, documentTypeId: dtype.id, documentTypeName: dtype.name,
  homeLocationId: shelf.id, status: 'AVAILABLE', confidentiality: 'INTERNAL', condition: 'GOOD',
  custodianName: 'AUDIT-TEST Custodian',
  documentDate: '2026-01-15', description: 'AUDIT-TEST safe test record', ...extra } }, admin);

// --- T1: Approve & Release without tempLocationId (UI behavior) ---
const d1 = (await mkDoc('AUDIT-TEST Doc 1 - dispatch repro')).json;
const req1 = await api('POST', '/api/checkouts/request', { documentId: d1.id, purpose: 'AUDIT-TEST reproduction', dueDate: '2026-12-01' }, admin);
const chk1 = req1.json;
const appr1 = await api('POST', `/api/checkouts/${chk1.id}/approve`, {}, admin);
const disp1 = await api('POST', `/api/checkouts/${chk1.id}/dispatch`, {}, admin); // UI sends NO tempLocationId
const chkAfter = (await api('GET', '/api/checkouts', undefined, admin)).json.find(c => c.id === chk1.id);
const docAfter = (await api('GET', `/api/documents/${d1.id}`, undefined, admin)).json;
log('T1', 'Approve & Release (no temp location) -> dispatch', {
  request: req1.status, approve: { status: appr1.status, body: appr1.json },
  dispatch: { status: disp1.status, body: disp1.json },
  checkoutStatusAfter: chkAfter?.status, documentStatusAfter: docAfter?.status,
  currentLocationIdAfter: docAfter?.currentLocationId });

// --- T1b: can the stuck APPROVED checkout be recovered via API with a location? ---
const disp1b = await api('POST', `/api/checkouts/${chk1.id}/dispatch`, { tempLocationId: shelf.id }, admin);
const chk1b = (await api('GET', '/api/checkouts', undefined, admin)).json.find(c => c.id === chk1.id);
log('T1b', 'Recovery: dispatch again WITH tempLocationId', { status: disp1b.status, body: disp1b.json, checkoutStatusAfter: chk1b?.status });

// --- T2: role downgrade on signup (Settings offers RECORDS_OFFICER) ---
const shortPw = await api('POST', '/api/auth/signup', { fullName: 'AUDIT Short PW', email: 'audit-shortpw@test.local', password: 'abc123', role: 'DEPT_USER', departmentId: deptA.id, departmentName: deptA.name, title: 't' });
const su = await api('POST', '/api/auth/signup', { fullName: 'AUDIT-TEST Officer', email: 'audit-officer@test.local', password: 'AuditTest-123', role: 'RECORDS_OFFICER', departmentId: deptA.id, departmentName: deptA.name, title: 'Records Officer' });
const users1 = (await api('GET', '/api/users', undefined, admin)).json;
const created = users1.find(u => u.email === 'audit-officer@test.local');
const appr2 = await api('PATCH', `/api/users/${created.id}/approval`, { status: 'APPROVED' }, admin);
const users2 = (await api('GET', '/api/users', undefined, admin)).json;
const approved = users2.find(u => u.email === 'audit-officer@test.local');
log('T2', 'Signup RECORDS_OFFICER -> approve -> actual role', {
  shortPasswordSignup: { status: shortPw.status, body: shortPw.json },
  signup: { status: su.status, requestedRole: 'RECORDS_OFFICER', storedRole: created?.role },
  afterApprovalRole: approved?.role });

// --- T3: department self-change -> CONFIDENTIAL access escalation ---
const offLogin = await api('POST', '/api/auth/login', { email: 'audit-officer@test.local', password: 'AuditTest-123' });
const offCookie = offLogin.cookie;
const confDoc = (await mkDoc('AUDIT-TEST Confidential Dept B', { departmentId: deptB.id, departmentName: deptB.name, confidentiality: 'CONFIDENTIAL' })).json;
const before = (await api('GET', `/api/documents/${confDoc.id}`, undefined, offCookie));
const selfUpd = await api('PUT', `/api/users/${approved.id}`, { departmentId: deptB.id, departmentName: deptB.name }, offCookie);
const after = (await api('GET', `/api/documents/${confDoc.id}`, undefined, offCookie));
const listAfter = (await api('GET', '/api/documents', undefined, offCookie)).json;
log('T3', 'Self department change -> CONFIDENTIAL doc access', {
  loginAsOfficer: offLogin.status,
  getConfDocBefore: { status: before.status },
  selfUpdate: { status: selfUpd.status, body: selfUpd.json },
  getConfDocAfter: { status: after.status, title: after.json?.title },
  visibleInListAfter: Array.isArray(listAfter) ? listAfter.some(d => d.id === confDoc.id) : 'n/a' });

// --- T4: restore backup into NON-EMPTY database (import) ---
const exp = await api('GET', '/api/export', undefined, admin);
const imp = await api('POST', '/api/import', exp.json, admin);
const docsAfterImport = (await api('GET', '/api/documents', undefined, admin)).json;
log('T4', 'Export then re-import into same non-empty DB', {
  exportStatus: exp.status, importStatus: imp.status, importBody: imp.json,
  documentCountAfter: Array.isArray(docsAfterImport) ? docsAfterImport.length : 'n/a' });

// --- T5: delete document type that is in use ---
const delType = await api('DELETE', `/api/document-types/${dtype.id}`, undefined, admin);
log('T5', 'Delete in-use document type', { status: delType.status, body: delType.json });

// --- T6: past dueDate accepted + OVERDUE never set ---
const d2 = (await mkDoc('AUDIT-TEST Doc 2 - overdue repro')).json;
const req2 = await api('POST', '/api/checkouts/request', { documentId: d2.id, purpose: 'AUDIT-TEST overdue', dueDate: '2020-01-01' }, admin);
const chk2 = req2.json;
await api('POST', `/api/checkouts/${chk2.id}/approve`, {}, admin);
const disp2 = await api('POST', `/api/checkouts/${chk2.id}/dispatch`, { tempLocationId: shelf.id }, admin);
const allChk = (await api('GET', '/api/checkouts', undefined, admin)).json;
log('T6', 'Checkout with dueDate 2020-01-01 (6 years overdue)', {
  requestAccepted: req2.status, dispatch: disp2.status,
  checkoutStatus: allChk.find(c => c.id === chk2.id)?.status,
  anyOverdueAnywhere: allChk.some(c => c.status === 'OVERDUE') });

// --- T7: batch-move a CHECKED_OUT document ---
const bm = await api('POST', '/api/documents/batch-move', { documentIds: [d2.id], toLocationId: shelf.id, reason: 'AUDIT-TEST move while checked out' }, admin);
const d2after = (await api('GET', `/api/documents/${d2.id}`, undefined, admin)).json;
log('T7', 'Batch-move document while CHECKED_OUT', { status: bm.status, body: bm.json, docStatusAfter: d2after?.status });

// --- T8: delete document with active checkout ---
const delDoc = await api('DELETE', `/api/documents/${d2.id}`, undefined, admin);
const chkOrphan = (await api('GET', '/api/checkouts', undefined, admin)).json.find(c => c.id === chk2.id);
log('T8', 'Delete document that has an active checkout', { deleteStatus: delDoc.status, deleteBody: delDoc.json, orphanCheckoutStatus: chkOrphan?.status, orphanDocumentId: chkOrphan?.documentId });

// --- T9: return flow on orphaned checkout (what does UI show?) ---
const ret = await api('POST', `/api/checkouts/${chk2.id}/return`, { condition: 'GOOD', notes: 'AUDIT-TEST return of orphan' }, admin);
log('T9', 'Return orphaned checkout', { status: ret.status, body: ret.json });

const fs = await import('fs');
fs.writeFileSync('repro-results.json', JSON.stringify(results, null, 2));
console.log('\nSaved repro-results.json');