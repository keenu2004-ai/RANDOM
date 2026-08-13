import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 004_master_data_audit_and_timezone_lifecycle...');
  const client = await beginTransaction();
  
  try {
    console.log('Adding timezone column to organizations...');
    await client.query(`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';
    `);

    console.log('Adding is_active and deleted_at columns to attendance_locations...');
    await client.query(`
      ALTER TABLE attendance_locations 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);

    await client.query(`
      ALTER TABLE attendance_locations 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;
    `);

    console.log('Creating master_data_audit_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS master_data_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        request_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.commit();
    console.log('Migration 004 committed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration 004 failed:', err);
    throw err;
  }
}

migrate().catch(console.error);
