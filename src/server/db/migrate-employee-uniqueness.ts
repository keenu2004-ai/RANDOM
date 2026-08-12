import { query } from './client.js';

async function migrate() {
  console.log('Starting migration: Multi-tenant Employee Uniqueness');
  try {
    
    // Drop the old constraints (the names might be employees_employee_code_key and employees_email_key by default in postgres)
    console.log('Dropping old global unique constraints...');
    await query(`ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key`);
    await query(`ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key`);
    
    console.log('Adding composite unique constraints...');
    // Create new constraints
    await query(`ALTER TABLE employees ADD CONSTRAINT unique_org_emp_code UNIQUE(organization_id, employee_code)`);
    await query(`ALTER TABLE employees ADD CONSTRAINT unique_org_email UNIQUE(organization_id, email)`);
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
