import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Robust SQL splitter that understands Postgres dollar quotes, strings, and comments
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let inDollarQuote = false;
  let dollarQuoteTag = '';
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    
    if (inSingleLineComment) {
      current += char;
      if (char === '\n') {
        inSingleLineComment = false;
      }
      continue;
    }
    
    if (inMultiLineComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        current += nextChar;
        i++;
      }
      continue;
    }
    
    if (inString) {
      current += char;
      if (char === "'") {
        if (nextChar === "'") {
          current += nextChar;
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    
    if (inDollarQuote) {
      current += char;
      if (char === '$') {
        const potentialTag = sql.slice(i, i + dollarQuoteTag.length);
        if (potentialTag === dollarQuoteTag) {
          inDollarQuote = false;
          current += potentialTag.slice(1);
          i += potentialTag.length - 1;
        }
      }
      continue;
    }
    
    if (char === '-' && nextChar === '-') {
      inSingleLineComment = true;
      current += char;
      continue;
    }
    
    if (char === '/' && nextChar === '*') {
      inMultiLineComment = true;
      current += char;
      continue;
    }
    
    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }
    
    if (char === '$') {
      const tagMatch = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (tagMatch) {
        inDollarQuote = true;
        dollarQuoteTag = tagMatch[0];
        current += dollarQuoteTag;
        i += dollarQuoteTag.length - 1;
        continue;
      }
    }
    
    if (char === ';') {
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim().length > 0) {
    statements.push(current.trim());
  }
  
  return statements;
}

async function migrate() {
  console.log('[MIGRATION] Starting database migration...');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('FATAL: DATABASE_URL is required for PostgreSQL database operations.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    max: 1, // Max 1 for sequential migration execution
  });

  try {
    const client = await pool.connect();
    console.log('[MIGRATION] Connected to PostgreSQL successfully.');
    
    // Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get applied migrations
    const appliedRes = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
    const appliedMigrations = new Set(appliedRes.rows.map(row => row.version));

    const migrationsDir = path.join(process.cwd(), 'src', 'server', 'db', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[MIGRATION] No migrations directory found at', migrationsDir);
      client.release();
      process.exit(0);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`[MIGRATION] Skipping ${file} (already applied)`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const rawSqlContent = fs.readFileSync(filePath, 'utf-8');
      const sqlContent = rawSqlContent.replace(/\0/g, ''); // Fix for UTF-16 null byte corruption
      
      const statements = splitSql(sqlContent);
      
      try {
        await client.query('BEGIN');
        
        for (const statement of statements) {
          // Remove single-line comments for the check
          const cleanStmt = statement.replace(/--.*$/gm, '').trim();
          if (cleanStmt.length > 0) {
            console.log(`[MIGRATION] Executing statement: ${cleanStmt.substring(0, 50).replace(/\n/g, ' ')}...`);
            await client.query(cleanStmt);
          }
        }
        
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATION] Applied ${file} successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATION] Error executing ${file}:`, err);
        throw err;
      }
    }

    client.release();
    console.log('[MIGRATION] All migrations applied successfully.');
  } catch (error) {
    console.error('[MIGRATION] Migration process failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
