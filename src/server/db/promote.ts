import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function promote() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('No DATABASE_URL found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const client = await pool.connect();
    
    // Find the admin user
    const userRes = await client.query("SELECT id, organization_id FROM users WHERE email = 'admin@theiakshi.com'");
    if (userRes.rows.length === 0) {
      console.error('Admin user not found');
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    const orgId = userRes.rows[0].organization_id;

    // Find SUPER_ADMIN role
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'SUPER_ADMIN' AND organization_id = $1", [orgId]);
    if (roleRes.rows.length === 0) {
      console.error('SUPER_ADMIN role not found');
      process.exit(1);
    }
    const roleId = roleRes.rows[0].id;

    // Update user role
    await client.query("UPDATE user_roles SET role_id = $1 WHERE user_id = $2", [roleId, userId]);
    
    console.log('Successfully promoted admin@theiakshi.com to SUPER_ADMIN!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

promote();
