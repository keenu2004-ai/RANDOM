import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 010_phase6_helpdesk_documents migration...');
  const client = await beginTransaction();
  
  try {
    console.log('Creating helpdesk and document tables if missing...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS helpdesk_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS helpdesk_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        category_id UUID REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'MEDIUM',
        status VARCHAR(50) DEFAULT 'OPEN',
        assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ticket_id UUID NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL,
        is_required BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        document_type_id UUID REFERENCES document_types(id) ON DELETE SET NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size_bytes BIGINT,
        mime_type VARCHAR(100),
        storage_provider VARCHAR(50) DEFAULT 'LOCAL_STORAGE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`ALTER TABLE helpdesk_tickets ALTER COLUMN ticket_number DROP NOT NULL;`);
    await client.query(`ALTER TABLE helpdesk_tickets ALTER COLUMN category DROP NOT NULL;`);
    await client.query(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES helpdesk_categories(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS description TEXT;`);
    await client.query(`ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE employee_documents ALTER COLUMN title DROP NOT NULL;`);
    await client.query(`ALTER TABLE employee_documents ALTER COLUMN category DROP NOT NULL;`);
    await client.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS document_type_id UUID REFERENCES document_types(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);`);
    await client.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_path TEXT;`);
    await client.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;`);
    await client.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);`);
    await client.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'LOCAL_STORAGE';`);

    await client.commit();
    console.log('Migration 010 completed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration 010 failed:', err);
    throw err;
  }
}

migrate().catch(console.error);
