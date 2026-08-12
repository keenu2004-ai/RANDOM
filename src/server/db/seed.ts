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
      INSERT INTO organizations (name, slug, domain, contact_email)
      VALUES ('Theiakshi Enterprise', 'theiakshi-enterprise', 'theiakshi.com', 'admin@theiakshi.com')
      RETURNING id
    `);
    const orgId = orgRes.rows[0].id;

    // Insert Users
    const adminUserRes = await client.query(`
      INSERT INTO users (organization_id, email, password_hash, role, is_active, is_email_verified)
      VALUES ($1, 'admin@theiakshi.com', $2, 'ADMIN', true, true)
      RETURNING id
    `, [orgId, defaultPassword]);

    const hrUserRes = await client.query(`
      INSERT INTO users (organization_id, email, password_hash, role, is_active, is_email_verified)
      VALUES ($1, 'hr@theiakshi.com', $2, 'HR_MANAGER', true, true)
      RETURNING id
    `, [orgId, defaultPassword]);

    const empUserRes = await client.query(`
      INSERT INTO users (organization_id, email, password_hash, role, is_active, is_email_verified)
      VALUES ($1, 'employee@theiakshi.com', $2, 'EMPLOYEE', true, true)
      RETURNING id
    `, [orgId, empPassword]);

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
