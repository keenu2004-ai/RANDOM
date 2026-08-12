import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load .env explicitly for CLI scripts
dotenv.config();

async function seed() {
  console.log('[SEED] Starting database seeding...');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('FATAL: DATABASE_URL is required for PostgreSQL database operations.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    max: 1, // Only need 1 connection for seeding
  });

  try {
    const client = await pool.connect();
    console.log('[SEED] Connected to PostgreSQL successfully.');

    // Very basic idempotent seed check - check if main admin exists
    const adminCheck = await client.query("SELECT * FROM users WHERE email = 'admin@theiakshi.com'");
    if (adminCheck.rows.length > 0) {
      console.log('[SEED] Database is already seeded. Aborting to preserve data.');
      client.release();
      process.exit(0);
    }

    console.log('[SEED] Executing seed operation...');
    
    // Hash password for default users
    const defaultPassword = await bcrypt.hash('Admin@123', 10);
    const empPassword = await bcrypt.hash('Emp@123', 10);

    // Insert Default Organization
    const orgRes = await client.query(`
      INSERT INTO organizations (name, code, website)
      VALUES ('Theiakshi Enterprise', 'THEIAKSHI', 'theiakshi.com')
      ON CONFLICT (code) DO UPDATE SET website = EXCLUDED.website
      RETURNING id
    `);
    const orgId = orgRes.rows[0].id;

    // Insert Roles
    const roles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
    const roleIds: Record<string, string> = {};
    for (const role of roles) {
      const roleRes = await client.query(`
        INSERT INTO roles (organization_id, name)
        VALUES ($1, $2)
        ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [orgId, role]);
      roleIds[role] = roleRes.rows[0].id;
    }

    // Insert Users
    const adminUserRes = await client.query(`
      INSERT INTO users (organization_id, email, password_hash, is_active)
      VALUES ($1, 'admin@theiakshi.com', $2, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [orgId, defaultPassword]);
    
    await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [adminUserRes.rows[0].id, roleIds['ADMIN']]);

    const hrUserRes = await client.query(`
      INSERT INTO users (organization_id, email, password_hash, is_active)
      VALUES ($1, 'hr@theiakshi.com', $2, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [orgId, defaultPassword]);
    
    await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [hrUserRes.rows[0].id, roleIds['HR_MANAGER']]);

    const empUserRes = await client.query(`
      INSERT INTO users (organization_id, email, password_hash, is_active)
      VALUES ($1, 'employee@theiakshi.com', $2, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [orgId, empPassword]);
    
    await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [empUserRes.rows[0].id, roleIds['EMPLOYEE']]);

    console.log('[SEED] Successfully seeded initial organization and users.');

    client.release();
    console.log('[SEED] Database seeding completed successfully.');
  } catch (error) {
    console.error('[SEED] Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
