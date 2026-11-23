import { randomBytes, randomUUID } from 'node:crypto';
import { getPool, isDbConnected } from './index.js';
import { hashPassword } from '../auth/session.js';

/**
 * Bootstrap seeding: on an empty database, create the initial administrator so
 * the system is usable out of the box. Credentials come from
 * BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD; when no password is
 * configured a strong random one is generated and printed ONCE to the server
 * log. Existing data is never modified or deleted.
 */
export async function seedDatabase(force: boolean = false): Promise<void> {
  const pool = getPool();
  if (!pool || !isDbConnected()) {
    return;
  }

  const client = await pool.connect();
  try {
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    const count = parseInt(userCheck.rows[0]?.count || '0', 10);

    if (count > 0) {
      // Database already contains live data, do not perform any deletion or override
      return;
    }

    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@archivehub.local').trim().toLowerCase();
    let password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
    let generated = false;
    if (!password) {
      password = randomBytes(12).toString('base64url');
      generated = true;
    }
    if (password.length < 8) {
      console.error('[Seed] BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters; bootstrap admin was NOT created.');
      return;
    }

    const hashed = await hashPassword(password);
    await client.query(
      `INSERT INTO users (id, email, password, full_name, role, department_id, department_name, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      ['usr-bootstrap-' + randomUUID(), email, hashed, 'System Administrator', 'ADMIN', null, 'Records Office', 'APPROVED']
    );

    console.log(`[Seed] Bootstrap administrator created: ${email}`);
    if (generated) {
      console.log(`[Seed] Generated bootstrap password (shown once, change it after first login): ${password}`);
    }
  } catch (error) {
    console.error('[Seed] Bootstrap seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}