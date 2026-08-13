import { query } from './client.js';

async function migrate() {
  console.log('Starting migration: Organization GPS Settings Fields');
  try {
    const stmts = [
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS office_latitude DECIMAL(10,8) DEFAULT 28.6209;`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS office_longitude DECIMAL(11,8) DEFAULT 77.1363;`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS allowed_geofence_radius_meters INTEGER DEFAULT 500;`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enforce_gps_check_in BOOLEAN DEFAULT true;`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS shift_start_time VARCHAR(10) DEFAULT '09:00';`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS shift_end_time VARCHAR(10) DEFAULT '18:00';`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 15;`
    ];

    for (const stmt of stmts) {
      await query(stmt);
      console.log(`Executed: ${stmt}`);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
