import { getPool } from './index.js';

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.warn('[Migration] Skipping PostgreSQL migration: DATABASE_URL is not configured.');
    return;
  }

  const client = await pool.connect();

  try {
    console.log('[Migration] Starting PostgreSQL schema migration...');
    await client.query('BEGIN');

    // 1. Departments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        head_name VARCHAR(255) NOT NULL,
        document_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255),
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department_id VARCHAR(50),
        department_name VARCHAR(255),
        avatar_url TEXT,
        title VARCHAR(255),
        approval_status VARCHAR(50) DEFAULT 'APPROVED',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'APPROVED';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(255);
    `);

    // 3. Document Types Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_types (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        retention_years INTEGER NOT NULL DEFAULT 5,
        description TEXT,
        department_id VARCHAR(50),
        department_name VARCHAR(255),
        custom_fields JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE document_types ADD COLUMN IF NOT EXISTS department_id VARCHAR(50);
      ALTER TABLE document_types ADD COLUMN IF NOT EXISTS department_name VARCHAR(255);
    `);

    // 4. Locations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id VARCHAR(50) PRIMARY KEY,
        parent_id VARCHAR(50),
        type VARCHAR(50) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        capacity INTEGER DEFAULT 20,
        current_occupancy INTEGER DEFAULT 0,
        qr_code VARCHAR(100) NOT NULL UNIQUE,
        barcode VARCHAR(100) NOT NULL,
        department_id VARCHAR(50),
        department_name VARCHAR(255),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    `);

    // 5. Documents Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(50) PRIMARY KEY,
        document_number VARCHAR(100) NOT NULL UNIQUE,
        reference_number VARCHAR(100),
        title VARCHAR(500) NOT NULL,
        document_type_id VARCHAR(50) NOT NULL,
        document_type_name VARCHAR(255) NOT NULL,
        subject TEXT,
        description TEXT,
        department_id VARCHAR(50) NOT NULL,
        department_name VARCHAR(255) NOT NULL,
        custodian_name VARCHAR(255) NOT NULL,
        home_location_id VARCHAR(50) NOT NULL,
        current_location_id VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
        confidentiality VARCHAR(50) NOT NULL DEFAULT 'INTERNAL',
        condition VARCHAR(50) NOT NULL DEFAULT 'EXCELLENT',
        qr_code VARCHAR(100) NOT NULL UNIQUE,
        barcode VARCHAR(100) NOT NULL,
        document_date VARCHAR(50) NOT NULL,
        received_date VARCHAR(50),
        filed_date VARCHAR(50),
        retention_start_date VARCHAR(50),
        retention_end_date VARCHAR(50),
        disposal_date VARCHAR(50),
        has_digital_copy BOOLEAN DEFAULT FALSE,
        digital_file_name VARCHAR(255),
        digital_file_size VARCHAR(50),
        digital_file_type VARCHAR(50),
        digital_file_version INTEGER DEFAULT 1,
        custom_metadata JSONB,
        custom_field_values JSONB,
        condition_notes TEXT,
        bundle_id VARCHAR(50),
        bundle_number VARCHAR(100),
        bundle_title VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS bundle_id VARCHAR(50);
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS bundle_number VARCHAR(100);
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS bundle_title VARCHAR(500);
    `);

    // 6. Checkouts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS checkouts (
        id VARCHAR(50) PRIMARY KEY,
        document_id VARCHAR(50) NOT NULL,
        document_number VARCHAR(100) NOT NULL,
        document_title VARCHAR(500) NOT NULL,
        requested_by_user_id VARCHAR(50) NOT NULL,
        requested_by_user_name VARCHAR(255) NOT NULL,
        requested_by_department VARCHAR(255) NOT NULL,
        approved_by_user_id VARCHAR(50),
        approved_by_user_name VARCHAR(255),
        checked_out_by_user_id VARCHAR(50),
        checked_out_by_user_name VARCHAR(255),
        returned_by_user_name VARCHAR(255),
        request_date VARCHAR(50) NOT NULL,
        checkout_date VARCHAR(50),
        due_date VARCHAR(50) NOT NULL,
        return_date VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
        purpose TEXT NOT NULL,
        condition_out VARCHAR(50) NOT NULL DEFAULT 'EXCELLENT',
        condition_in VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 7. Movements Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS movements (
        id VARCHAR(50) PRIMARY KEY,
        document_id VARCHAR(50) NOT NULL,
        document_number VARCHAR(100) NOT NULL,
        document_title VARCHAR(500) NOT NULL,
        from_location_id VARCHAR(50),
        from_location_path TEXT NOT NULL,
        to_location_id VARCHAR(50),
        to_location_path TEXT NOT NULL,
        movement_type VARCHAR(50) NOT NULL,
        performed_by_user_id VARCHAR(50),
        performed_by_user_name VARCHAR(255) NOT NULL,
        authorized_by_user_name VARCHAR(255),
        reason TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT
      );
    `);

    // 8. Retention Policies Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS retention_policies (
        id VARCHAR(50) PRIMARY KEY,
        document_type_id VARCHAR(50) NOT NULL,
        document_type_name VARCHAR(255) NOT NULL,
        retention_years INTEGER NOT NULL DEFAULT 5,
        disposal_method VARCHAR(50) NOT NULL,
        description TEXT
      );
    `);

    // 9. Disposal Records Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS disposal_records (
        id VARCHAR(50) PRIMARY KEY,
        document_id VARCHAR(50),
        document_number VARCHAR(100) NOT NULL,
        document_title VARCHAR(500) NOT NULL,
        requested_by_user_name VARCHAR(255) NOT NULL,
        approved_by_user_name VARCHAR(255) NOT NULL,
        disposal_date VARCHAR(50) NOT NULL,
        disposal_method VARCHAR(50) NOT NULL,
        certificate_number VARCHAR(100) NOT NULL,
        witness_name VARCHAR(255) NOT NULL,
        notes TEXT
      );
    `);

    // 10. Audit Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        user_name VARCHAR(255) NOT NULL,
        user_role VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50) NOT NULL,
        entity_name VARCHAR(255) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        details TEXT NOT NULL,
        before_value TEXT,
        after_value TEXT
      );
    `);

    // 11. Reusable Custom Fields Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reusable_custom_fields (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        label VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        options JSONB,
        placeholder TEXT,
        required BOOLEAN DEFAULT FALSE,
        description TEXT,
        category VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 12. Bundles & Dossiers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bundles (
        id VARCHAR(50) PRIMARY KEY,
        bundle_number VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        image_url TEXT,
        department_id VARCHAR(50) NOT NULL,
        department_name VARCHAR(255) NOT NULL,
        location_id VARCHAR(50),
        location_path TEXT,
        document_ids JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        qr_code VARCHAR(100) NOT NULL UNIQUE,
        barcode VARCHAR(100) NOT NULL,
        tags JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);

    await client.query('COMMIT');
    console.log('[Migration] PostgreSQL schema migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration] Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}
