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

// Reads a variable from the .env file first, then falls back to process.env.
function readEnvVar(parsed: Record<string, string> | null, name: string): string | undefined {
  const value = (parsed && parsed[name] !== undefined ? parsed[name] : process.env[name]) || '';
  return value.replace(/^["']|["']$/g, '').trim() || undefined;
}

// Resolves the active database provider: "supabase" | "local" (defaults to supabase).
export function getDbProvider(): 'supabase' | 'local' {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const raw = dotenv.parse(fs.readFileSync(envPath)).DB_PROVIDER;
      if (raw) return raw.toLowerCase() === 'local' ? 'local' : 'supabase';
    }
  } catch (err) {
    console.warn('[Database] Failed to parse .env file directly:', err);
  }
  return (process.env.DB_PROVIDER || '').toLowerCase() === 'local' ? 'local' : 'supabase';
}

export function getDatabaseUrl(): string | undefined {
  let parsed: Record<string, string> | null = null;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      parsed = dotenv.parse(fs.readFileSync(envPath));
    }
  } catch (err) {
    console.warn('[Database] Failed to parse .env file directly:', err);
  }

  // DB_PROVIDER=local | supabase selects which connection string is used.
  const provider = getDbProvider();
  const providerVar = provider === 'local' ? 'LOCAL_DATABASE_URL' : 'SUPABASE_DATABASE_URL';

  const url =
    readEnvVar(parsed, providerVar) ||
    readEnvVar(parsed, 'DATABASE_URL') ||
    process.env[providerVar] ||
    process.env.DATABASE_URL;

  if (url && !url.includes('[YOUR-PASSWORD]')) {
    return url;
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
      const provider = getDbProvider();
      const isRemote = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1');

      // Explicit override wins: PGSSL=disable is required for plain PostgreSQL
      // containers (e.g. the db service in docker compose) whose hostname is
      // neither localhost nor a Supabase host.
      const pgssl = (process.env.PGSSL || '').toLowerCase();
      const sslConfig = pgssl === 'disable'
        ? false
        : pgssl === 'require' || pgssl === 'prefer'
          ? { rejectUnauthorized: false }
          : provider === 'supabase'
            // Supabase/remote provider always requires SSL (also covers any
            // external PostgreSQL pointed at via DATABASE_URL fallback).
            ? { rejectUnauthorized: false }
            // Local provider: SSL off unless the URL/host says otherwise.
            : (databaseUrl.includes('sslmode=require') || (isRemote && databaseUrl.includes('supabase'))
                ? { rejectUnauthorized: false }
                : false);

      poolInstance = new Pool({
        connectionString: databaseUrl,
        ssl: sslConfig,
        connectionTimeoutMillis: 5000
      });

      poolInstance.on('error', (err) => {
        console.error('[Database] Unexpected error on idle PostgreSQL client:', err.message);
        isDbConnectedFlag = false;
      });

      dbInstance = drizzle(poolInstance, { schema });
      console.log(`[Database] PostgreSQL Pool initialized successfully (provider: ${provider}).`);
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
      message: 'No database is configured. Set DB_PROVIDER (supabase|local) and the matching connection string (SUPABASE_DATABASE_URL or LOCAL_DATABASE_URL) in .env.',
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
