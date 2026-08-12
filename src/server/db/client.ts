import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

let pgPool: Pool | null = null;
let pgliteDb: any = null; // using any to avoid static requirement

const provider = process.env.DATABASE_PROVIDER || 'pglite';
const isProd = process.env.NODE_ENV === 'production';

if (isProd && provider !== 'postgres') {
  console.error("FATAL: DATABASE_PROVIDER must be 'postgres' in production.");
  process.exit(1);
}

if (provider === 'postgres') {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("FATAL: DATABASE_URL is missing but DATABASE_PROVIDER=postgres.");
    process.exit(1);
  }
  pgPool = new Pool({
    connectionString: dbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else if (provider === 'pglite') {
  if (isProd) {
    console.error("FATAL: PGlite cannot be used in production.");
    process.exit(1);
  }
} else {
  console.error(`FATAL: Invalid DATABASE_PROVIDER '${provider}'. Use 'postgres' or 'pglite'.`);
  process.exit(1);
}

async function getPgliteDb() {
  if (pgliteDb) return pgliteDb;
  
  const dataDir = path.join(process.cwd(), 'data', 'pglite');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const { PGlite } = await import('@electric-sql/pglite');
  pgliteDb = new PGlite(dataDir);
  return pgliteDb;
}

let isInitialized = false;

export async function initDatabase() {
  if (isInitialized) return;

  try {
    const schemaSqlPath = path.join(process.cwd(), 'src', 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf-8');
      
      if (pgPool) {
        await pgPool.query(schemaSql);
      } else if (provider === 'pglite') {
        const db = await getPgliteDb();
        await db.exec(schemaSql);
      }
      
      console.log(`PostgreSQL schema initialized successfully via ${provider}.`);
    }
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize PostgreSQL schema:', error);
    throw error;
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  await initDatabase();
  if (pgPool) {
    const res = await pgPool.query<T>(sql, params);
    return res.rows;
  } else if (provider === 'pglite') {
    const db = await getPgliteDb();
    const res = await db.query(sql, params) as any;
    return res.rows;
  }
  return [];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function exec(sql: string) {
  await initDatabase();
  if (pgPool) {
    return await pgPool.query(sql);
  } else if (provider === 'pglite') {
    const db = await getPgliteDb();
    return await db.exec(sql);
  }
}

// Transaction support
export interface TransactionClient {
  query: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  queryOne: <T = any>(sql: string, params?: any[]) => Promise<T | null>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

export async function beginTransaction(): Promise<TransactionClient> {
  await initDatabase();
  
  if (pgPool) {
    const client = await pgPool.connect();
    await client.query('BEGIN');
    
    return {
      query: async <T = any>(sql: string, params?: any[]) => {
        const res = await client.query<T>(sql, params);
        return res.rows;
      },
      queryOne: async <T = any>(sql: string, params?: any[]) => {
        const res = await client.query<T>(sql, params);
        return res.rows.length > 0 ? res.rows[0] : null;
      },
      commit: async () => {
        try { await client.query('COMMIT'); } finally { client.release(); }
      },
      rollback: async () => {
        try { await client.query('ROLLBACK'); } finally { client.release(); }
      }
    };
  } else if (provider === 'pglite') {
    const db = await getPgliteDb();
    await db.query('BEGIN');
    return {
      query: async <T = any>(sql: string, params?: any[]) => {
        const res = await db.query(sql, params) as any;
        return res.rows;
      },
      queryOne: async <T = any>(sql: string, params?: any[]) => {
        const res = await db.query(sql, params) as any;
        return res.rows.length > 0 ? res.rows[0] : null;
      },
      commit: async () => {
        await db.query('COMMIT');
      },
      rollback: async () => {
        await db.query('ROLLBACK');
      }
    };
  }
  
  throw new Error("No database provider available");
}
