import { query } from '../src/server/db/client';

async function migrate() {
  console.log('Running Phase 2 Migration...');
  try {
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('Successfully added reset_token_hash to users table.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

migrate();
