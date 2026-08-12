/**
 * THEIAKSHI ENTERPRISE — Global Test Setup
 * Initializes PGlite database ONCE before all test files run.
 * This prevents each test file from triggering schema initialization.
 */

import { initDatabase } from '../src/server/db/client';

export async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PROVIDER = 'pglite';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only-not-production';

  console.log('[GLOBAL SETUP] Pre-initializing PGlite test database...');

  try {
    await initDatabase();
    console.log('[GLOBAL SETUP] PGlite ready for tests.');
  } catch (err) {
    console.warn('[GLOBAL SETUP] PGlite init warning:', (err as Error).message);
    // Non-fatal — tests will retry as needed
  }
}

