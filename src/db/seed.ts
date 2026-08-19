import { getPool, isDbConnected } from './index.js';

export async function seedDatabase(force: boolean = false): Promise<void> {
  const pool = getPool();
  if (!pool || !isDbConnected()) {
    return;
  }

  const client = await pool.connect();
  try {
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    const count = parseInt(userCheck.rows[0]?.count || '0', 10);

    if (count > 0 && !force) {
      // Database already contains live data, do not perform any deletion or override
      return;
    }
  } catch (error) {
    console.error('[Seed] Health verification check notice:', error);
  } finally {
    client.release();
  }
}

