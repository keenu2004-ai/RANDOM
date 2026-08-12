/**
 * THEIAKSHI ENTERPRISE — Test Database Lifecycle
 * Manages isolated test database connections, schema init, and cleanup.
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SAFETY GUARD: Never run tests against production
if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    'TEST SAFETY VIOLATION: NODE_ENV must be "test" to run the test suite. ' +
    'Current NODE_ENV: ' + process.env.NODE_ENV
  );
}

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

let pool: Pool | null = null;
let isTestDbAvailable = false;

export function getTestPool(): Pool {
  if (!pool) {
    throw new Error('Test database not initialized. Call initTestDb() first.');
  }
  return pool;
}

export function isPostgresAvailable(): boolean {
  return isTestDbAvailable;
}

export async function initTestDb(): Promise<void> {
  if (!TEST_DATABASE_URL) {
    console.warn('[TEST-DB] TEST_DATABASE_URL not set. PostgreSQL integration tests will be SKIPPED.');
    isTestDbAvailable = false;
    return;
  }

  try {
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 3000,
    });

    // Verify connection
    await pool.query('SELECT 1');
    isTestDbAvailable = true;
    console.log('[TEST-DB] Connected to test database successfully.');

    // Initialize schema
    const schemaPath = path.join(__dirname, '../../src/server/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(schema);
      console.log('[TEST-DB] Schema initialized.');
    }
  } catch (err) {
    console.warn('[TEST-DB] Could not connect to test database:', (err as Error).message);
    console.warn('[TEST-DB] PostgreSQL tests requiring a real DB will be SKIPPED.');
    isTestDbAvailable = false;
    pool = null;
  }
}

export async function cleanupTestDb(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
  isTestDbAvailable = false;
  console.log('[TEST-DB] Test database pool closed.');
}

/**
 * Run a raw query against the test database.
 * Use sparingly — prefer HTTP integration tests.
 */
export async function testQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
  if (!pool) throw new Error('Test database not initialized.');
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

/**
 * Truncate test data between test suites to ensure isolation.
 * Preserves schema structure.
 */
export async function truncateTestData(tables: string[]): Promise<void> {
  if (!pool) return;
  const tableList = tables.join(', ');
  await pool.query(`TRUNCATE TABLE ${tableList} CASCADE`);
}
