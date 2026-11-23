// AUDIT SANDBOX round 2 - clean escalation test, valid return, dispatch race.
const BASE = 'http://localhost:3032';
const results = [];
function log(id, name, detail) { results.push({ id, name, detail }); console.log(`\n=== ${id}: ${name} ===\n` + JSON.stringify(detail, null, 1)); }
async function api(method, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get('set-cookie');
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json, cookie: sc ? sc.split(';')[0] : cookie };
}
const login = await api('POST', '/api/auth/login', { email: 'audit-admin@test.local', password: 'AuditTest-Admin-2026' });
const admin = login.cookie;
const depts = (await api('GET', '/api/departments', undefined, admin)).json;
const deptA = depts.find(d => d.code === 'AUDITA'), deptB = depts.find(d => d.code === 'AUDITB');
const locs = (await api('GET', '/api/locations', undefined, admin)).json;
const shelf = locs.find(l => l.code === 'AUDIT-SHELF');
let types = (await api('GET', '/api/document-types', undefined, admin)).json;
let dtype = types.find(t => t.code === 'AUDIT-TYPE');
if (!dtype) dtype = (await api('POST', '/api/document-types', { name: 'AUDIT-TEST Type', code: 'AUDIT-TYPE', retentionYears: 5, customFields: [] }, admin)).json;
const mkDoc = (title, extra = {}) => api('POST', '/api/documents', { docData: {
  title, departmentId: deptA.id, departmentName: deptA.name, documentTypeId: dtype.id, documentTypeName: dtype.name,
  homeLocationId: shelf.id, status: 'AVAILABLE', confidentiality: 'INTERNAL', condition: 'GOOD',
  custodianName: 'AUDIT-TEST Custodian', documentDate: '2026-01-15', ...extra } }, admin);

// --- R1: CLEAN department self-escalation with a FRESH deptA user ---
const su = await api('POST', '/api/auth/signup', { fullName: 'AUDIT-TEST DeptUser', email: 'audit-deptuser@test.local', password: 'AuditTest-123', role: 'DEPT_USER', departmentId: deptA.id, departmentName: deptA.name, title: 'Staff' });
const users = (await api('GET', '/api/users', undefined, admin)).json;
const du = users.find(u => u.email === 'audit-deptuser@test.local');
await api('PATCH', `/api/users/${du.id}/approval`, { status: 'APPROVED' }, admin);
const duLogin = await api('POST', '/api/auth/login', { email: 'audit-deptuser@test.local', password: 'AuditTest-123' });
const duCookie = duLogin.cookie;
const conf = (await mkDoc('AUDIT-TEST R1 Confidential Dept B', { departmentId: deptB.id, departmentName: deptB.name, confidentiality: 'CONFIDENTIAL' })).json;
const before = await api('GET', `/api/documents/${conf.id}`, undefined, duCookie);
const beforeList = (await api('GET', '/api/documents', undefined, duCookie)).json;
const upd = await api('PUT', `/api/users/${du.id}`, { departmentId: deptB.id, departmentName: deptB.name }, duCookie);
const after = await api('GET', `/api/documents/${conf.id}`, undefined, duCookie);
const afterList = (await api('GET', '/api/documents', undefined, duCookie)).json;
log('R1', 'Fresh deptA user -> self-switch to deptB -> CONFIDENTIAL access', {
  signup: su.status, deptBefore: duLogin.json?.user?.departmentName,
  getBefore: before.status, inListBefore: Array.isArray(beforeList) && beforeList.some(d => d.id === conf.id),
  selfUpdate: upd.status,
  getAfter: after.status, inListAfter: Array.isArray(afterList) && afterList.some(d => d.id === conf.id) });

// --- R2: dispatch BEFORE approve completes (UI fires both without await) ---
const d3 = (await mkDoc('AUDIT-TEST R2 race')).json;
const req3 = (await api('POST', '/api/checkouts/request', { documentId: d3.id, purpose: 'AUDIT-TEST race', dueDate: '2026-12-01' }, admin)).json;
const [apprR, dispR] = await Promise.all([
  api('POST', `/api/checkouts/${req3.id}/approve`, {}, admin),
  api('POST', `/api/checkouts/${req3.id}/dispatch`, {}, admin) // exactly what the UI sends
]);
const chk3 = (await api('GET', '/api/checkouts', undefined, admin)).json.find(c => c.id === req3.id);
log('R2', 'UI race: approve + dispatch fired concurrently, no tempLocationId', {
  approve: { status: apprR.status, body: apprR.json }, dispatch: { status: dispR.status, body: dispR.json },
  finalCheckoutStatus: chk3?.status });

// --- R3: valid return flow (correct UI payload) ---
const d4 = (await mkDoc('AUDIT-TEST R3 return')).json;
const req4 = (await api('POST', '/api/checkouts/request', { documentId: d4.id, purpose: 'AUDIT-TEST return', dueDate: '2026-12-01' }, admin)).json;
await api('POST', `/api/checkouts/${req4.id}/approve`, {}, admin);
await api('POST', `/api/checkouts/${req4.id}/dispatch`, { tempLocationId: shelf.id }, admin);
const ret = await api('POST', `/api/checkouts/${req4.id}/return`, { conditionIn: 'GOOD', returnLocationId: shelf.id, notes: 'AUDIT-TEST valid return' }, admin);
const d4after = (await api('GET', `/api/documents/${d4.id}`, undefined, admin)).json;
const chk4 = (await api('GET', '/api/checkouts', undefined, admin)).json.find(c => c.id === req4.id);
log('R3', 'Valid return with returnLocationId', { return: ret.status, docStatus: d4after?.status, checkoutStatus: chk4?.status, condition: d4after?.condition });

// --- R4: location hierarchy abuse via API (FOLDER parenting a BUILDING) ---
const folder = (await api('POST', '/api/locations', { name: 'AUDIT-TEST Folder', code: 'AUDIT-FLD', type: 'FOLDER', parentId: null, capacity: 10 }, admin)).json;
const bld2 = await api('POST', '/api/locations', { name: 'AUDIT-TEST Bld under folder', code: 'AUDIT-BLD2', type: 'BUILDING', parentId: folder?.id, capacity: 100 }, admin);
log('R4', 'Create BUILDING with FOLDER parent', { folderCreated: folder?.id ? true : folder, buildingUnderFolder: { status: bld2.status, body: bld2.json?.id || bld2.json } });

// --- R5: bulk-update API accepts arbitrary fields? (defense-in-depth) ---
const bu = await api('POST', '/api/documents/bulk-update', { documentIds: [d4.id], updates: { status: 'DISPOSED', confidentiality: 'PUBLIC' } }, admin);
const d4bu = (await api('GET', `/api/documents/${d4.id}`, undefined, admin)).json;
log('R5', 'Bulk-update API with status field (UI never sends this)', { status: bu.status, body: bu.json, docStatusAfter: d4bu?.status, confidentialityAfter: d4bu?.confidentiality });

const fs = await import('fs');
fs.writeFileSync('repro2-results.json', JSON.stringify(results, null, 2));
console.log('\nSaved repro2-results.json');