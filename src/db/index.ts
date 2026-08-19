import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

dotenv.config();

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let isDbConnectedFlag = false;

export function getDatabaseUrl(): string | undefined {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      if (parsed.DATABASE_URL && !parsed.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
        return parsed.DATABASE_URL.replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch (err) {
    console.warn('[Database] Failed to parse .env file directly:', err);
  }

  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
    return process.env.DATABASE_URL.replace(/^["']|["']$/g, '').trim();
  }

  return undefined;
}

export function getPool(): pg.Pool | null {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  if (!poolInstance) {
    try {
      const isRemote = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1');

      poolInstance = new Pool({
        connectionString: databaseUrl,
        ssl: isRemote || databaseUrl.includes('supabase') || databaseUrl.includes('sslmode=require') 
          ? { rejectUnauthorized: false } 
          : false,
        connectionTimeoutMillis: 5000
      });

      poolInstance.on('error', (err) => {
        console.error('[Database] Unexpected error on idle PostgreSQL client:', err.message);
        isDbConnectedFlag = false;
      });

      dbInstance = drizzle(poolInstance, { schema });
      console.log('[Database] PostgreSQL Pool initialized successfully.');
    } catch (err) {
      console.error('[Database] Failed to initialize PostgreSQL Pool:', err);
      poolInstance = null;
    }
  }

  return poolInstance;
}

export function getDb() {
  getPool();
  return dbInstance;
}

export function isDbConnected(): boolean {
  return isDbConnectedFlag;
}

export function setDbConnected(connected: boolean): void {
  isDbConnectedFlag = connected;
}

// Export pgPool proxy so existing calls to pgPool.query / pgPool.connect resolve dynamically
export const pgPool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const activePool = getPool();
    if (!activePool) return undefined;
    const value = (activePool as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activePool);
    }
    return value;
  }
});

export async function checkDatabaseHealth(): Promise<{ connected: boolean; message: string; timestamp: string }> {
  const timestamp = new Date().toISOString();
  
  const activePool = getPool();

  if (!activePool) {
    isDbConnectedFlag = false;
    return {
      connected: false,
      message: 'DATABASE_URL is not configured in .env file or contains default placeholder password.',
      timestamp
    };
  }

  try {
    const client = await activePool.connect();
    await client.query('SELECT 1');
    client.release();
    isDbConnectedFlag = true;
    console.log('[Database] Health Check Succeeded: Connected to PostgreSQL!');
    return {
      connected: true,
      message: 'PostgreSQL connection active.',
      timestamp
    };
  } catch (error: any) {
    isDbConnectedFlag = false;
    console.warn('[Database] Connection check failed:', error?.message);
    if (poolInstance) {
      try { await poolInstance.end(); } catch (_) {}
      poolInstance = null;
    }
    return {
      connected: false,
      message: `Database connection failed: ${error?.message || 'Unknown error'}`,
      timestamp
    };
  }
}
