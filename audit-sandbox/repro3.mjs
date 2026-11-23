// AUDIT SANDBOX round 3 - retention record + date round-trip check.
const BASE = 'http://localhost:3032';
async function api(method, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get('set-cookie');
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json, cookie: sc ? sc.split(';')[0] : cookie };
}
const login = await api('POST', '/api/auth/login', { email: 'audit-admin@test.local', password: 'AuditTest-Admin-2026' });
console.log('login', login.status);
const admin = login.cookie;
const depts = (await api('GET', '/api/departments', undefined, admin)).json;
const A = depts.find(d => d.code === 'AUDITA');
const locs = (await api('GET', '/api/locations', undefined, admin)).json;
const shelf = locs.find(l => l.code === 'AUDIT-SHELF');
const types = (await api('GET', '/api/document-types', undefined, admin)).json;
const t = types[0];
const mk = await api('POST', '/api/documents', { docData: {
  title: 'AUDIT-TEST retention expiring 2028', departmentId: A.id, departmentName: A.name,
  documentTypeId: t.id, documentTypeName: t.name, homeLocationId: shelf.id, status: 'AVAILABLE',
  confidentiality: 'INTERNAL', condition: 'GOOD', custodianName: 'AUDIT',
  documentDate: '2023-06-01', receivedDate: '2023-06-01', filedDate: '2023-06-01',
  retentionStartDate: '2023-06-01', retentionEndDate: '2028-06-01' } }, admin);
console.log('create', mk.status, mk.json?.documentNumber);
const get = await api('GET', `/api/documents/${mk.json.id}`, undefined, admin);
console.log('ROUND-TRIP sent documentDate=2023-06-01 retentionEndDate=2028-06-01');
console.log('read back documentDate=', get.json?.documentDate, 'retentionEndDate=', get.json?.retentionEndDate, 'receivedDate=', get.json?.receivedDate);
const chk = (await api('GET', '/api/checkouts', undefined, admin)).json;
const overdueOne = chk.find(c => c.purpose === 'AUDIT-TEST overdue');
console.log('overdue checkout sent dueDate=2020-01-01, read back dueDate=', overdueOne?.dueDate);