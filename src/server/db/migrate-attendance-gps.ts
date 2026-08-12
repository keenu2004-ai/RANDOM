import { query } from './client.js';

async function migrate() {
  console.log('Starting migration: Attendance GPS Fields');
  try {
    const stmts = [
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_latitude DECIMAL(10,8);`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_longitude DECIMAL(11,8);`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_accuracy DECIMAL(8,2);`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_latitude DECIMAL(10,8);`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_longitude DECIMAL(11,8);`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_accuracy DECIMAL(8,2);`
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
