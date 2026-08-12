import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env explicitly for CLI scripts
dotenv.config();

async function migrate() {
  console.log('[MIGRATION] Starting database migration...');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('FATAL: DATABASE_URL is required for PostgreSQL database operations.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    max: 1, // Only need 1 connection for migrations
  });

  try {
    const client = await pool.connect();
    console.log('[MIGRATION] Connected to PostgreSQL successfully.');
    
    // 1. Initial Schema
    const schemaPath = path.join(process.cwd(), 'src', 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('[MIGRATION] Executing schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schemaSql);
      console.log('[MIGRATION] schema.sql executed successfully.');
    } else {
      console.warn('[MIGRATION] schema.sql not found at', schemaPath);
    }

    // 2. Phase 2 Migration (adding reset_token to users)
    console.log('[MIGRATION] Executing Phase 2 updates...');
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('[MIGRATION] Phase 2 updates executed successfully.');

    client.release();
    console.log('[MIGRATION] All migrations completed successfully.');
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
