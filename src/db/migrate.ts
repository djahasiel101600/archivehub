import { getPool } from './index.js';
import { sanitizeCodeSegment, extractSuffix, DOC_NUMBER_SUFFIX_WIDTH } from '../utils/documentNumber.js';

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
        digital_file_path TEXT,
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
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS digital_file_path TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS qr_claimed BOOLEAN DEFAULT FALSE;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS qr_claimed_at TIMESTAMPTZ;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS qr_claimed_by VARCHAR(50);
      ALTER TABLE documents ALTER COLUMN title DROP NOT NULL;
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

    // 12b. Integrity & performance hardening (idempotent).
    // gen_random_uuid() is built-in on PG13+; pgcrypto covers older servers.
    await client.query(`
      DO $$ BEGIN
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'pgcrypto unavailable; gen_random_uuid() requires PostgreSQL 13+';
      END $$;
    `);

    // Unique barcode indexes. Legacy duplicate rows must not block startup, so
    // a violation downgrades to a notice and the index is skipped.
    for (const table of ['documents', 'locations', 'bundles']) {
      await client.query(`
        DO $$ BEGIN
          CREATE UNIQUE INDEX IF NOT EXISTS uq_${table}_barcode ON ${table}(barcode);
        EXCEPTION WHEN unique_violation THEN
          RAISE NOTICE '${table}.barcode contains legacy duplicates; unique index skipped';
        END $$;
      `);
    }

    // Lookup indexes for the hot query paths (filters, joins, trails).
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_current_location ON documents(current_location_id);
      CREATE INDEX IF NOT EXISTS idx_documents_home_location ON documents(home_location_id);
      CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department_id);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type_id);
      CREATE INDEX IF NOT EXISTS idx_documents_bundle ON documents(bundle_id);
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
      CREATE INDEX IF NOT EXISTS idx_documents_confidentiality ON documents(confidentiality);
      CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
      CREATE INDEX IF NOT EXISTS idx_checkouts_document ON checkouts(document_id);
      CREATE INDEX IF NOT EXISTS idx_checkouts_status ON checkouts(status);
      CREATE INDEX IF NOT EXISTS idx_movements_document ON movements(document_id);
      CREATE INDEX IF NOT EXISTS idx_movements_timestamp ON movements(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_id);
      CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);
      CREATE INDEX IF NOT EXISTS idx_bundles_department ON bundles(department_id);
    `);

    // Circulation trails must survive record deletion: keep the history rows
    // with a NULL document reference instead of blocking the delete.
    await client.query(`
      ALTER TABLE checkouts ALTER COLUMN document_id DROP NOT NULL;
      ALTER TABLE movements ALTER COLUMN document_id DROP NOT NULL;
    `);

    // Foreign keys are added NOT VALID so orphaned legacy rows do not fail the
    // migration; new writes are still checked against the referenced tables.
    const addForeignKey = async (name: string, table: string, column: string, refTable: string, onDelete: string) => {
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE ${table} ADD CONSTRAINT ${name}
            FOREIGN KEY (${column}) REFERENCES ${refTable}(id) ON DELETE ${onDelete} NOT VALID;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    };
    await addForeignKey('fk_documents_department', 'documents', 'department_id', 'departments', 'RESTRICT');
    await addForeignKey('fk_documents_type', 'documents', 'document_type_id', 'document_types', 'RESTRICT');
    await addForeignKey('fk_documents_home_location', 'documents', 'home_location_id', 'locations', 'RESTRICT');
    await addForeignKey('fk_documents_current_location', 'documents', 'current_location_id', 'locations', 'RESTRICT');
    await addForeignKey('fk_documents_bundle', 'documents', 'bundle_id', 'bundles', 'SET NULL');
    await addForeignKey('fk_checkouts_document', 'checkouts', 'document_id', 'documents', 'SET NULL');
    await addForeignKey('fk_movements_document', 'movements', 'document_id', 'documents', 'SET NULL');
    await addForeignKey('fk_bundles_department', 'bundles', 'department_id', 'departments', 'RESTRICT');
    await addForeignKey('fk_bundles_location', 'bundles', 'location_id', 'locations', 'SET NULL');
    await addForeignKey('fk_locations_parent', 'locations', 'parent_id', 'locations', 'SET NULL');
    await addForeignKey('fk_users_department', 'users', 'department_id', 'departments', 'SET NULL');
    await addForeignKey('fk_document_types_department', 'document_types', 'department_id', 'departments', 'SET NULL');
    await addForeignKey('fk_retention_document_type', 'retention_policies', 'document_type_id', 'document_types', 'CASCADE');

    // Convert ISO date strings to real DATE columns for correct range queries
    // and ordering. Guarded by data_type so re-runs are no-ops; malformed
    // legacy values become NULL rather than failing the migration.
    const convertToDate = async (table: string, column: string) => {
      const check = await client.query(
        'SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
        [table, column]
      );
      if (check.rows.length === 0 || check.rows[0].data_type === 'date') return;
      await client.query(`
        ALTER TABLE ${table} ALTER COLUMN ${column} TYPE DATE
        USING CASE WHEN ${column} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN ${column}::date ELSE NULL END
      `);
    };
    await client.query('ALTER TABLE documents ALTER COLUMN document_date DROP NOT NULL;');
    for (const column of ['document_date', 'received_date', 'filed_date', 'retention_start_date', 'retention_end_date', 'disposal_date']) {
      await convertToDate('documents', column);
    }
    for (const column of ['request_date', 'checkout_date', 'due_date', 'return_date']) {
      await convertToDate('checkouts', column);
    }
    await convertToDate('disposal_records', 'disposal_date');

    // 13. One-time backfill: renumber legacy auto-generated "NIA-YYYY-NNNNNN"
    // records into the structured {DEPT_CODE}-{TYPE_CODE}-{NNNN} scheme.
    // Idempotent — once renumbered, rows no longer match the legacy pattern.
    const legacyDocs = await client.query(`
      SELECT d.id, d.document_number, dep.code AS dept_code, dt.code AS type_code
      FROM documents d
      LEFT JOIN departments dep ON dep.id = d.department_id
      LEFT JOIN document_types dt ON dt.id = d.document_type_id
      WHERE d.document_number ~ '^NIA-[0-9]{4}-[0-9]{6}$'
      ORDER BY d.created_at
    `);
    if (legacyDocs.rows.length > 0) {
      const usedNumbers = new Set<string>(
        (await client.query('SELECT document_number FROM documents')).rows.map((r: any) => r.document_number as string)
      );
      // Highest suffix already taken per prefix, so collisions are impossible
      const counters = new Map<string, number>();
      let renumbered = 0;
      for (const row of legacyDocs.rows) {
        const prefix = `${sanitizeCodeSegment(row.dept_code, 'GEN')}-${sanitizeCodeSegment(row.type_code, 'DOC')}`;
        if (!counters.has(prefix)) {
          let max = 0;
          for (const num of usedNumbers) {
            const suffix = extractSuffix(prefix, num);
            if (suffix !== null && suffix > max) max = suffix;
          }
          counters.set(prefix, max);
        }
        let candidate = '';
        do {
          const next = (counters.get(prefix) || 0) + 1;
          counters.set(prefix, next);
          candidate = `${prefix}-${String(next).padStart(DOC_NUMBER_SUFFIX_WIDTH, '0')}`;
        } while (usedNumbers.has(candidate));
        usedNumbers.delete(row.document_number);
        usedNumbers.add(candidate);

        await client.query(
          'UPDATE documents SET document_number = $1, qr_code = $2, updated_at = NOW() WHERE id = $3',
          [candidate, 'DOC-' + candidate, row.id]
        );
        // Keep the denormalized copies in the circulation trail consistent
        await client.query('UPDATE movements SET document_number = $1 WHERE document_id = $2', [candidate, row.id]);
        await client.query('UPDATE checkouts SET document_number = $1 WHERE document_id = $2', [candidate, row.id]);
        await client.query('UPDATE disposal_records SET document_number = $1 WHERE document_id = $2', [candidate, row.id]);
        renumbered++;
      }
      console.log(`[Migration] Backfilled ${renumbered} legacy NIA-* document number(s) to the structured scheme.`);
    }

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
